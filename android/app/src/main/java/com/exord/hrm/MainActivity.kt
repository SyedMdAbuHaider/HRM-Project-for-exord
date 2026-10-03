package com.exord.hrm
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.viewmodel.compose.viewModel
import com.exord.hrm.ui.HrmViewModel

class MainActivity:ComponentActivity(){ override fun onCreate(savedInstanceState:Bundle?){super.onCreate(savedInstanceState);setContent{ExordApp()}} }
@Composable fun ExordApp(vm:HrmViewModel=viewModel(factory=HrmViewModel.factory(application))){ val state by vm.state.collectAsState(); MaterialTheme(colorScheme=lightColorScheme(primary=Color(0xFFE31E24))){Surface(Modifier.fillMaxSize()){if(state.loggedIn) Dashboard(vm,state.name,state.role) else Login(vm,state.loading,state.error)}}}
@Composable fun Login(vm:HrmViewModel,loading:Boolean,error:String?){Column(Modifier.fillMaxSize().padding(24.dp),verticalArrangement=Arrangement.Center,horizontalAlignment=Alignment.CenterHorizontally){Text("EXORD ONLINE",fontWeight=FontWeight.Black,letterSpacing=2.sp);Spacer(Modifier.height(10.dp));Text("HRM",fontSize=38.sp,fontWeight=FontWeight.Black);Text("Employee & Workforce Management",color=Color.Gray);Spacer(Modifier.height(30.dp));OutlinedTextField(vm.identifier,{vm.identifier=it},label={Text("Employee ID / Email")},singleLine=true,modifier=Modifier.fillMaxWidth());Spacer(Modifier.height(12.dp));OutlinedTextField(vm.password,{vm.password=it},label={Text("Password")},singleLine=true,modifier=Modifier.fillMaxWidth());if(error!=null)Text(error,color=MaterialTheme.colorScheme.error);Spacer(Modifier.height(18.dp));Button(onClick=vm::login,enabled=!loading,modifier=Modifier.fillMaxWidth(),shape=RoundedCornerShape(14.dp)){Text(if(loading)"Signing in…" else "Sign In")}}}
@Composable fun Dashboard(vm:HrmViewModel,name:String,role:String){Scaffold(bottomBar={NavigationBar{listOf("Home","People","Attend","Requests","Chat").forEachIndexed{i,label->NavigationBarItem(selected=i==0,onClick={},icon={Text("•")},label={Text(label)})}}}){p->Column(Modifier.fillMaxSize().padding(p).padding(16.dp)){Text("Welcome",color=Color(0xFFE31E24),fontWeight=FontWeight.Bold);Text(name,fontSize=28.sp,fontWeight=FontWeight.Black);Text(role,color=Color.Gray);Spacer(Modifier.height(18.dp));Card(Modifier.fillMaxWidth(),shape=RoundedCornerShape(24.dp)){Column(Modifier.padding(20.dp)){Text("Today",fontWeight=FontWeight.Bold);Spacer(Modifier.height(12.dp));Text("Attendance");Text("Attendance, leave, payroll, chat and workforce data are synchronized with the HRM server.")}};Spacer(Modifier.height(14.dp));Button(onClick=vm::logout,modifier=Modifier.fillMaxWidth()){Text("Sign out")}}}}