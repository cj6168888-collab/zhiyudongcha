package com.xiaozhi.ui

import android.Manifest
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import android.util.Log
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.core.content.ContextCompat
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import com.xiaozhi.agent.XiaoZhiAgent
import com.xiaozhi.network.DeviceManager
import com.xiaozhi.services.XiaoZhiAgentService
import com.xiaozhi.ui.screens.*
import com.xiaozhi.ui.theme.XiaoZhiTheme

class MainActivity : ComponentActivity() {

    companion object {
        private const val TAG = "MainActivity"

        private val REQUIRED_PERMISSIONS = arrayOf(
            Manifest.permission.RECORD_AUDIO,
            Manifest.permission.CAMERA,
            Manifest.permission.POST_NOTIFICATIONS,
            Manifest.permission.BLUETOOTH_CONNECT,
            Manifest.permission.BLUETOOTH_SCAN,
            Manifest.permission.ACCESS_FINE_LOCATION,
            Manifest.permission.ACCESS_COARSE_LOCATION,
            Manifest.permission.CALL_PHONE,
            Manifest.permission.SEND_SMS,
            Manifest.permission.READ_SMS,
            Manifest.permission.READ_CONTACTS,
            Manifest.permission.READ_EXTERNAL_STORAGE,
            Manifest.permission.WRITE_EXTERNAL_STORAGE,
            Manifest.permission.QUERY_ALL_PACKAGES
        )
    }

    // Agent单例引用
    private var agent: XiaoZhiAgent? = null

    // 权限请求
    private val permissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { permissions ->
        val allGranted = permissions.all { it.value }
        if (allGranted) {
            Log.i(TAG, "All permissions granted")
        } else {
            Log.w(TAG, "Some permissions denied: ${permissions.filter { !it.value }.keys}")
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        Log.i(TAG, "MainActivity created")

        // 1. 请求权限
        requestPermissions()

        // 2. 初始化并启动Agent
        initializeAgent()

        // 3. 启动前台服务
        XiaoZhiAgentService.start(this)

        // 4. 设置UI
        setContent {
            XiaoZhiTheme {
                MainScreen()
            }
        }
    }

    override fun onResume() {
        super.onResume()
        Log.d(TAG, "MainActivity resumed")
    }

    override fun onPause() {
        super.onPause()
        Log.d(TAG, "MainActivity paused")
    }

    override fun onDestroy() {
        Log.i(TAG, "MainActivity destroyed")
        // 注意：不在这里停止Agent服务，让它在后台运行
        super.onDestroy()
    }

    /**
     * 请求权限
     */
    private fun requestPermissions() {
        val permissionsToRequest = REQUIRED_PERMISSIONS.filter { permission ->
            ContextCompat.checkSelfPermission(this, permission) != PackageManager.PERMISSION_GRANTED
        }.toTypedArray()

        if (permissionsToRequest.isNotEmpty()) {
            Log.i(TAG, "Requesting ${permissionsToRequest.size} permissions")
            permissionLauncher.launch(permissionsToRequest)
        } else {
            Log.i(TAG, "All permissions already granted")
        }
    }

    /**
     * 初始化Agent
     */
    private fun initializeAgent() {
        try {
            val deviceId = DeviceManager.getDeviceId(this)

            agent = XiaoZhiAgent.getInstance(this).apply {
                initialize(
                    serverUrl = "wss://api.xiaozhi.app/ws/device",
                    httpUrl = "https://api.xiaozhi.app",
                    deviceId = deviceId,
                    deviceToken = "",
                    deviceName = "${Build.MANUFACTURER} ${Build.MODEL}"
                )
            }

            Log.i(TAG, "Agent initialized: $deviceId")

        } catch (e: Exception) {
            Log.e(TAG, "Failed to initialize agent", e)
        }
    }

    /**
     * 获取Agent实例
     */
    fun getAgent(): XiaoZhiAgent? = agent
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun MainScreen() {
    val navController = rememberNavController()
    val currentBackStackEntry by navController.currentBackStackEntryAsState()
    val currentRoute = currentBackStackEntry?.destination?.route

    // 底部导航项
    val items = listOf(
        BottomNavItem("chat", "对话", Icons.Default.Chat),
        BottomNavItem("insight", "洞察", Icons.Default.Hearing),
        BottomNavItem("devices", "设备", Icons.Default.Smartphone),
        BottomNavItem("contacts", "人脉", Icons.Default.People),
        BottomNavItem("projects", "项目", Icons.Default.Folder),
        BottomNavItem("settings", "设置", Icons.Default.Settings)
    )

    Scaffold(
        bottomBar = {
            NavigationBar {
                items.forEach { item ->
                    NavigationBarItem(
                        icon = { Icon(item.icon, contentDescription = item.label) },
                        label = { Text(item.label) },
                        selected = currentRoute == item.route,
                        onClick = {
                            if (currentRoute != item.route) {
                                navController.navigate(item.route) {
                                    popUpTo(navController.graph.startDestinationId)
                                    launchSingleTop = true
                                }
                            }
                        }
                    )
                }
            }
        }
    ) { paddingValues ->
        NavHost(
            navController = navController,
            startDestination = "chat",
            modifier = Modifier.padding(paddingValues)
        ) {
            composable("chat") { ChatScreen() }
            composable("insight") { InsightListenerScreen() }
            composable("devices") { DeviceControlScreen() }
            composable("contacts") { ContactsScreen() }
            composable("projects") { ProjectsScreen() }
            composable("settings") { SettingsScreen() }

data class BottomNavItem(
    val route: String,
    val label: String,
    val icon: androidx.compose.ui.graphics.vector.ImageVector
)
