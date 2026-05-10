package com.xiaozhi.ui.screens

import android.Manifest
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
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
import com.xiaozhi.speech.SpeechRecognitionService
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

enum class TalkType(val label: String, val color: Color) {
    CASUAL("闲聊", Color.Gray),
    MEETING("会议", Color(0xFF2196F3)),
    NEGOTIATION("谈判", Color(0xFFFF9800)),
    INTERVIEW("面试", Color(0xFF9C27B0)),
    LEGAL("法务", Color(0xFFF44336))
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun InsightListenerScreen() {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    
    var selectedType by remember { mutableStateOf(TalkType.MEETING) }
    var isListening by remember { mutableStateOf(false) }
    var duration by remember { mutableStateOf(0) }
    var volumeLevel by remember { mutableStateOf(0) }
    
    val speechService = remember { SpeechRecognitionService(context) }
    val transcript by speechService.transcript.collectAsState()
    val interimTranscript by speechService.interimTranscript.collectAsState()
    
    val permissionLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) { granted ->
        if (granted) {
            speechService.startRecording()
            isListening = true
        }
    }
    
    LaunchedEffect(isListening) {
        while (isListening) {
            delay(1000)
            duration++
            volumeLevel = (2..7).random()
        }
    }
    
    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("智语洞察") },
                actions = {
                    IconButton(onClick = { }) {
                        Icon(Icons.Default.History, contentDescription = "历史")
                    }
                }
            )
        }
    ) { paddingValues ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
        ) {
            LazyRow(
                contentPadding = PaddingValues(16.dp),
                horizontalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                items(TalkType.values()) { type ->
                    FilterChip(
                        selected = selectedType == type,
                        onClick = { selectedType = type },
                        label = { Text(type.label) },
                        colors = FilterChipDefaults.filterChipColors(
                            selectedContainerColor = type.color.copy(alpha = 0.2f),
                            selectedLabelColor = type.color
                        )
                    )
                }
            }
            
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(MaterialTheme.colorScheme.surfaceVariant)
                    .padding(16.dp),
                horizontalArrangement = Arrangement.SpaceEvenly
            ) {
                StatusItem(
                    icon = Icons.Default.GraphicEq,
                    label = "状态",
                    value = if (isListening) "录音中" else "待机",
                    color = if (isListening) Color.Green else Color.Gray
                )
                StatusItem(
                    icon = Icons.Default.Timer,
                    label = "时长",
                    value = String.format("%02d:%02d", duration / 60, duration % 60),
                    color = MaterialTheme.colorScheme.primary
                )
                StatusItem(
                    icon = Icons.Default.People,
                    label = "人物",
                    value = "0",
                    color = Color(0xFF2196F3)
                )
                StatusItem(
                    icon = Icons.Default.Lightbulb,
                    label = "机会",
                    value = "0",
                    color = Color(0xFF9C27B0)
                )
            }
            
            LazyColumn(
                modifier = Modifier
                    .weight(1f)
                    .fillMaxWidth()
                    .padding(16.dp)
            ) {
                if (isListening) {
                    item {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            Box(
                                modifier = Modifier
                                    .size(8.dp)
                                    .clip(CircleShape)
                                    .background(Color.Red)
                            )
                            Text(
                                "正在录音...",
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.outline
                            )
                        }
                        Spacer(modifier = Modifier.height(8.dp))
                    }
                }
                
                if (transcript.isNotEmpty()) {
                    item {
                        Surface(
                            shape = RoundedCornerShape(12.dp),
                            color = MaterialTheme.colorScheme.surface,
                            tonalElevation = 1.dp
                        ) {
                            Text(
                                text = transcript,
                                modifier = Modifier.padding(16.dp),
                                style = MaterialTheme.typography.bodyMedium
                            )
                        }
                        Spacer(modifier = Modifier.height(8.dp))
                    }
                }
                
                if (interimTranscript.isNotEmpty()) {
                    item {
                        Surface(
                            shape = RoundedCornerShape(12.dp),
                            color = MaterialTheme.colorScheme.surfaceVariant
                        ) {
                            Text(
                                text = interimTranscript,
                                modifier = Modifier.padding(16.dp),
                                style = MaterialTheme.typography.bodyMedium,
                                color = MaterialTheme.colorScheme.outline
                            )
                        }
                    }
                }
            }
            
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(MaterialTheme.colorScheme.surface)
                    .padding(16.dp),
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                if (isListening) {
                    Row(
                        horizontalArrangement = Arrangement.spacedBy(4.dp),
                        modifier = Modifier.padding(bottom = 16.dp)
                    ) {
                        repeat(7) { index ->
                            Box(
                                modifier = Modifier
                                    .width(6.dp)
                                    .height((8 + index * 4).dp * if (index < volumeLevel) 1f else 0.3f)
                                    .clip(RoundedCornerShape(2.dp))
                                    .background(
                                        if (index < volumeLevel) Color.Green 
                                        else Color.Gray.copy(alpha = 0.3f)
                                    )
                            )
                        }
                    }
                }
                
                Row(
                    horizontalArrangement = Arrangement.spacedBy(24.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    FloatingActionButton(
                        onClick = {
                            if (isListening) {
                                speechService.stopRecording()
                                isListening = false
                            } else {
                                if (speechService.hasPermission()) {
                                    duration = 0
                                    speechService.startRecording()
                                    isListening = true
                                } else {
                                    permissionLauncher.launch(Manifest.permission.RECORD_AUDIO)
                                }
                            }
                        },
                        containerColor = if (isListening) 
                            MaterialTheme.colorScheme.error 
                        else 
                            MaterialTheme.colorScheme.primary
                    ) {
                        Icon(
                            if (isListening) Icons.Default.Stop else Icons.Default.Mic,
                            contentDescription = if (isListening) "停止" else "开始"
                        )
                    }
                    
                    if (transcript.isNotEmpty() && !isListening) {
                        Button(
                            onClick = { },
                            colors = ButtonDefaults.buttonColors(
                                containerColor = Color(0xFF9C27B0)
                            )
                        ) {
                            Icon(Icons.Default.AutoAwesome, contentDescription = null)
                            Spacer(modifier = Modifier.width(8.dp))
                            Text("分析")
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun StatusItem(
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    label: String,
    value: String,
    color: Color
) {
    Column(horizontalAlignment = Alignment.CenterHorizontally) {
        Icon(
            icon,
            contentDescription = label,
            tint = color,
            modifier = Modifier.size(24.dp)
        )
        Text(
            text = value,
            style = MaterialTheme.typography.titleMedium,
            fontWeight = FontWeight.Bold
        )
        Text(
            text = label,
            style = MaterialTheme.typography.labelSmall,
            color = MaterialTheme.colorScheme.outline
        )
    }
}
