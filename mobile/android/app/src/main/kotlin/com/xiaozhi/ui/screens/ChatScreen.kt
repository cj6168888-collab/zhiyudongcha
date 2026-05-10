package com.xiaozhi.ui.screens

import android.Manifest
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.xiaozhi.network.NetworkManager
import com.xiaozhi.speech.SpeechRecognitionService
import kotlinx.coroutines.launch
import java.text.SimpleDateFormat
import java.util.*

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ChatScreen() {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val listState = rememberLazyListState()
    
    var messages by remember { mutableStateOf(listOf(
        ChatMessage(
            content = "爸爸好！我是小智，您的数字生命助手。有什么我可以帮您的吗？",
            isFromUser = false
        )
    )) }
    var inputText by remember { mutableStateOf("") }
    var isVoiceMode by remember { mutableStateOf(false) }
    var isLoading by remember { mutableStateOf(false) }
    var isRecording by remember { mutableStateOf(false) }
    
    val speechService = remember { SpeechRecognitionService(context) }
    val isConnected by NetworkManager.isConnected.collectAsState()
    val transcript by speechService.transcript.collectAsState()
    
    val permissionLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) { granted ->
        if (granted) {
            speechService.startRecording()
            isRecording = true
        }
    }
    
    LaunchedEffect(transcript) {
        if (transcript.isNotEmpty() && !isRecording) {
            sendMessage(transcript, messages) { newMessages, loading ->
                messages = newMessages
                isLoading = loading
            }
        }
    }
    
    LaunchedEffect(messages.size) {
        if (messages.isNotEmpty()) {
            listState.animateScrollToItem(messages.size - 1)
        }
    }
    
    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("小智") },
                actions = {
                    Box(
                        modifier = Modifier
                            .size(8.dp)
                            .clip(CircleShape)
                            .background(if (isConnected) Color.Green else Color.Gray)
                    )
                    Spacer(modifier = Modifier.width(16.dp))
                }
            )
        }
    ) { paddingValues ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
        ) {
            LazyColumn(
                state = listState,
                modifier = Modifier
                    .weight(1f)
                    .fillMaxWidth(),
                contentPadding = PaddingValues(16.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                items(messages) { message ->
                    MessageBubble(message = message)
                }
                
                if (isLoading) {
                    item {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.Start
                        ) {
                            CircularProgressIndicator(
                                modifier = Modifier.size(24.dp),
                                strokeWidth = 2.dp
                            )
                        }
                    }
                }
            }
            
            Divider()
            
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(16.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                if (isVoiceMode) {
                    VoiceInputButton(
                        isRecording = isRecording,
                        modifier = Modifier.weight(1f),
                        onClick = {
                            if (isRecording) {
                                speechService.stopRecording()
                                isRecording = false
                            } else {
                                if (speechService.hasPermission()) {
                                    speechService.startRecording()
                                    isRecording = true
                                } else {
                                    permissionLauncher.launch(Manifest.permission.RECORD_AUDIO)
                                }
                            }
                        }
                    )
                } else {
                    OutlinedTextField(
                        value = inputText,
                        onValueChange = { inputText = it },
                        modifier = Modifier.weight(1f),
                        placeholder = { Text("输入消息...") },
                        singleLine = true,
                        shape = RoundedCornerShape(24.dp)
                    )
                    
                    IconButton(
                        onClick = {
                            if (inputText.isNotBlank()) {
                                scope.launch {
                                    sendMessage(inputText, messages) { newMessages, loading ->
                                        messages = newMessages
                                        isLoading = loading
                                    }
                                    inputText = ""
                                }
                            }
                        },
                        enabled = inputText.isNotBlank()
                    ) {
                        Icon(
                            Icons.Default.Send,
                            contentDescription = "发送",
                            tint = if (inputText.isNotBlank()) 
                                MaterialTheme.colorScheme.primary 
                            else 
                                MaterialTheme.colorScheme.outline
                        )
                    }
                }
                
                IconButton(onClick = { isVoiceMode = !isVoiceMode }) {
                    Icon(
                        if (isVoiceMode) Icons.Default.Keyboard else Icons.Default.Mic,
                        contentDescription = if (isVoiceMode) "切换键盘" else "切换语音",
                        tint = MaterialTheme.colorScheme.primary
                    )
                }
            }
        }
    }
}

@Composable
private fun MessageBubble(message: ChatMessage) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = if (message.isFromUser) Arrangement.End else Arrangement.Start
    ) {
        Column(
            horizontalAlignment = if (message.isFromUser) Alignment.End else Alignment.Start,
            modifier = Modifier.widthIn(max = 280.dp)
        ) {
            Surface(
                shape = RoundedCornerShape(
                    topStart = 16.dp,
                    topEnd = 16.dp,
                    bottomStart = if (message.isFromUser) 16.dp else 4.dp,
                    bottomEnd = if (message.isFromUser) 4.dp else 16.dp
                ),
                color = if (message.isFromUser) 
                    MaterialTheme.colorScheme.primary 
                else 
                    MaterialTheme.colorScheme.surfaceVariant
            ) {
                Text(
                    text = message.content,
                    modifier = Modifier.padding(12.dp),
                    color = if (message.isFromUser) 
                        MaterialTheme.colorScheme.onPrimary 
                    else 
                        MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
            
            message.toolInfo?.let { toolInfo ->
                Row(
                    modifier = Modifier.padding(top = 4.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(4.dp)
                ) {
                    Icon(
                        Icons.Default.CheckCircle,
                        contentDescription = null,
                        modifier = Modifier.size(12.dp),
                        tint = MaterialTheme.colorScheme.primary
                    )
                    Text(
                        text = toolInfo,
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.outline
                    )
                }
            }
        }
    }
}

@Composable
private fun VoiceInputButton(
    isRecording: Boolean,
    modifier: Modifier = Modifier,
    onClick: () -> Unit
) {
    Button(
        onClick = onClick,
        modifier = modifier.height(56.dp),
        shape = CircleShape,
        colors = ButtonDefaults.buttonColors(
            containerColor = if (isRecording) 
                MaterialTheme.colorScheme.error 
            else 
                MaterialTheme.colorScheme.primary
        )
    ) {
        Icon(
            if (isRecording) Icons.Default.Stop else Icons.Default.Mic,
            contentDescription = if (isRecording) "停止" else "开始录音"
        )
        Spacer(modifier = Modifier.width(8.dp))
        Text(if (isRecording) "停止录音" else "按住说话")
    }
}

private suspend fun sendMessage(
    text: String,
    currentMessages: List<ChatMessage>,
    onUpdate: (List<ChatMessage>, Boolean) -> Unit
) {
    val userMessage = ChatMessage(content = text, isFromUser = true)
    onUpdate(currentMessages + userMessage, true)
    
    val result = NetworkManager.chat(text)
    
    result.fold(
        onSuccess = { response ->
            val aiMessage = ChatMessage(
                content = response.reply,
                isFromUser = false,
                toolInfo = response.intent?.let { "执行: $it" }
            )
            onUpdate(currentMessages + userMessage + aiMessage, false)
        },
        onFailure = { error ->
            val errorMessage = ChatMessage(
                content = "抱歉，出现了一些问题：${error.message}",
                isFromUser = false
            )
            onUpdate(currentMessages + userMessage + errorMessage, false)
        }
    )
}

data class ChatMessage(
    val id: String = UUID.randomUUID().toString(),
    val content: String,
    val isFromUser: Boolean,
    val timestamp: Long = System.currentTimeMillis(),
    val toolInfo: String? = null
)
