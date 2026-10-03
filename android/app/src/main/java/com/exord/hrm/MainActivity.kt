package com.exord.hrm
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.foundation.layout.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp

class MainActivity : ComponentActivity() {
 override fun onCreate(savedInstanceState: Bundle?) { super.onCreate(savedInstanceState); setContent { ExordHRMApp() } }
}
@Composable fun ExordHRMApp() {
 var loggedIn by remember { mutableStateOf(false) }
 MaterialTheme { Surface(Modifier.fillMaxSize()) { if(loggedIn) HomeScreen() else LoginScreen { loggedIn=true } } }
}
@Composable fun LoginScreen(onLogin:()->Unit) {
 Column(Modifier.fillMaxSize().padding(24.dp), verticalArrangement=Arrangement.Center) {
  Text("Exord HRM", style=MaterialTheme.typography.headlineLarge)
  Spacer(Modifier.height(24.dp))
  Text("Native Android client foundation")
  Spacer(Modifier.height(24.dp))
  Button(onClick=onLogin, modifier=Modifier.fillMaxWidth()) { Text("Continue") }
 }
}
@Composable fun HomeScreen() {
 Column(Modifier.fillMaxSize().padding(24.dp)) {
  Text("Exord HRM", style=MaterialTheme.typography.headlineLarge)
  Spacer(Modifier.height(12.dp)); Text("Server-owned HRM")
 }
}