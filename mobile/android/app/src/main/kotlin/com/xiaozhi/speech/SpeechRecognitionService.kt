package com.xiaozhi.speech

import android.Manifest
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.media.AudioFormat
import android.media.AudioRecord
import android.media.MediaRecorder
import android.os.Bundle
import android.speech.RecognitionListener
import android.speech.RecognizerIntent
import android.speech.SpeechRecognizer
import androidx.core.content.ContextCompat
import com.xiaozhi.network.NetworkManager
import kotlinx.coroutines.*
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow

class SpeechRecognitionService(private val context: Context) {
    
    private val _isRecording = MutableStateFlow(false)
    val isRecording: StateFlow<Boolean> = _isRecording
    
    private val _transcript = MutableStateFlow("")
    val transcript: StateFlow<String> = _transcript
    
    private val _interimTranscript = MutableStateFlow("")
    val interimTranscript: StateFlow<String> = _interimTranscript
    
    private val _error = MutableStateFlow<String?>(null)
    val error: StateFlow<String?> = _error
    
    private var speechRecognizer: SpeechRecognizer? = null
    private var audioRecord: AudioRecord? = null
    private var useServerASR = false
    private var recordingJob: Job? = null
    private var audioChunkSequence = 0
    
    private val scope = CoroutineScope(Dispatchers.IO + SupervisorJob())
    
    init {
        useServerASR = !SpeechRecognizer.isRecognitionAvailable(context)
        
        NetworkManager.onASRResult = { text, isFinal ->
            if (isFinal) {
                _transcript.value = _transcript.value + if (_transcript.value.isEmpty()) text else "\n$text"
                _interimTranscript.value = ""
            }
        }
        
        NetworkManager.onASRInterim = { text ->
            _interimTranscript.value = text
        }
    }
    
    fun hasPermission(): Boolean {
        return ContextCompat.checkSelfPermission(
            context, 
            Manifest.permission.RECORD_AUDIO
        ) == PackageManager.PERMISSION_GRANTED
    }
    
    fun startRecording() {
        if (_isRecording.value) return
        
        _error.value = null
        _transcript.value = ""
        _interimTranscript.value = ""
        
        if (useServerASR) {
            startServerASR()
        } else {
            startLocalASR()
        }
    }
    
    fun stopRecording() {
        if (useServerASR) {
            stopServerASR()
        } else {
            stopLocalASR()
        }
        _isRecording.value = false
    }
    
    private fun startLocalASR() {
        speechRecognizer = SpeechRecognizer.createSpeechRecognizer(context).apply {
            setRecognitionListener(object : RecognitionListener {
                override fun onReadyForSpeech(params: Bundle?) {
                    _isRecording.value = true
                }
                
                override fun onBeginningOfSpeech() {}
                override fun onRmsChanged(rmsdB: Float) {}
                override fun onBufferReceived(buffer: ByteArray?) {}
                override fun onEndOfSpeech() {}
                
                override fun onError(error: Int) {
                    val errorMessage = when (error) {
                        SpeechRecognizer.ERROR_AUDIO -> "音频错误"
                        SpeechRecognizer.ERROR_CLIENT -> "客户端错误"
                        SpeechRecognizer.ERROR_INSUFFICIENT_PERMISSIONS -> "权限不足"
                        SpeechRecognizer.ERROR_NETWORK -> "网络错误，切换到云端识别"
                        SpeechRecognizer.ERROR_NETWORK_TIMEOUT -> "网络超时"
                        SpeechRecognizer.ERROR_NO_MATCH -> "无法识别"
                        SpeechRecognizer.ERROR_RECOGNIZER_BUSY -> "识别器忙"
                        SpeechRecognizer.ERROR_SERVER -> "服务器错误"
                        SpeechRecognizer.ERROR_SPEECH_TIMEOUT -> "语音超时"
                        else -> "未知错误"
                    }
                    
                    if (error == SpeechRecognizer.ERROR_NETWORK || 
                        error == SpeechRecognizer.ERROR_SERVER) {
                        useServerASR = true
                        startServerASR()
                    } else {
                        _error.value = errorMessage
                        _isRecording.value = false
                    }
                }
                
                override fun onResults(results: Bundle?) {
                    val matches = results?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)
                    if (!matches.isNullOrEmpty()) {
                        val text = matches[0]
                        _transcript.value = _transcript.value + 
                            if (_transcript.value.isEmpty()) text else "\n$text"
                    }
                    _interimTranscript.value = ""
                    
                    if (_isRecording.value) {
                        startListening()
                    }
                }
                
                override fun onPartialResults(partialResults: Bundle?) {
                    val matches = partialResults?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)
                    if (!matches.isNullOrEmpty()) {
                        _interimTranscript.value = matches[0]
                    }
                }
                
                override fun onEvent(eventType: Int, params: Bundle?) {}
            })
        }
        
        startListening()
        _isRecording.value = true
    }
    
    private fun startListening() {
        val intent = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
            putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
            putExtra(RecognizerIntent.EXTRA_LANGUAGE, "zh-CN")
            putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true)
            putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 1)
        }
        speechRecognizer?.startListening(intent)
    }
    
    private fun stopLocalASR() {
        speechRecognizer?.stopListening()
        speechRecognizer?.destroy()
        speechRecognizer = null
    }
    
    @Suppress("MissingPermission")
    private fun startServerASR() {
        if (!hasPermission()) {
            _error.value = "需要麦克风权限"
            return
        }
        
        NetworkManager.startASR()
        audioChunkSequence = 0
        
        val sampleRate = 16000
        val channelConfig = AudioFormat.CHANNEL_IN_MONO
        val audioFormat = AudioFormat.ENCODING_PCM_16BIT
        val bufferSize = AudioRecord.getMinBufferSize(sampleRate, channelConfig, audioFormat) * 2
        
        audioRecord = AudioRecord(
            MediaRecorder.AudioSource.MIC,
            sampleRate,
            channelConfig,
            audioFormat,
            bufferSize
        )
        
        audioRecord?.startRecording()
        _isRecording.value = true
        
        recordingJob = scope.launch {
            val buffer = ByteArray(bufferSize)
            while (isActive && _isRecording.value) {
                val bytesRead = audioRecord?.read(buffer, 0, bufferSize) ?: 0
                if (bytesRead > 0) {
                    audioChunkSequence++
                    NetworkManager.sendAudioChunk(
                        buffer.copyOf(bytesRead),
                        audioChunkSequence,
                        false
                    )
                }
            }
        }
    }
    
    private fun stopServerASR() {
        recordingJob?.cancel()
        recordingJob = null
        
        audioRecord?.stop()
        audioRecord?.release()
        audioRecord = null
        
        NetworkManager.stopASR()
    }
    
    fun release() {
        stopRecording()
        scope.cancel()
    }
}
