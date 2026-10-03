package com.exord.hrm

import android.app.Application
import android.os.Bundle
import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.location.Location
import android.location.LocationManager
import androidx.activity.result.contract.ActivityResultContracts
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.core.content.ContextCompat
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
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
import androidx.compose.ui.platform.LocalContext
import com.exord.hrm.data.model.Employee
import com.exord.hrm.ui.HrmViewModel

private val Red=Color(0xFFE31E24)
private val Ink=Color(0xFFF8FAFC)
private val Muted=Color(0xFF94A3B8)
private val Card=Color(0xFF0F172A)

class MainActivity:ComponentActivity(){
 private val locationPermission=registerForActivityResult(ActivityResultContracts.RequestMultiplePermissions()){}
 override fun onCreate(b:Bundle?){
  super.onCreate(b)
  if(ContextCompat.checkSelfPermission(this,Manifest.permission.ACCESS_FINE_LOCATION)!=PackageManager.PERMISSION_GRANTED)
   locationPermission.launch(arrayOf(Manifest.permission.ACCESS_FINE_LOCATION,Manifest.permission.ACCESS_COARSE_LOCATION))
  setContent{ExordApp()}
 }
}

@Composable fun ExordApp(){
 val app=LocalContext.current.applicationContext as Application
 val vm:HrmViewModel=viewModel(factory=HrmViewModel.factory(app))
 val s by vm.state.collectAsState()
 MaterialTheme(colorScheme=darkColorScheme(primary=Red,background=Color(0xFF020617),surface=Color(0xFF0F172A),onBackground=Color.White,onSurface=Color.White)){Surface(Modifier.fillMaxSize(),color=Color(0xFF020617)){if(s.loggedIn)Shell(vm,s.name,s.role)else Login(vm,s.loading,s.error)}}
}
@Composable fun Login(vm:HrmViewModel,loading:Boolean,error:String?){
 Column(Modifier.fillMaxSize().padding(24.dp),verticalArrangement=Arrangement.Center,horizontalAlignment=Alignment.CenterHorizontally){
  Text("EXORD ONLINE",color=Red,fontWeight=FontWeight.Black,letterSpacing=2.sp);Text("HRM",fontSize=42.sp,fontWeight=FontWeight.Black,color=Ink);Text("Employee & Workforce Management",color=Muted)
  Spacer(Modifier.height(30.dp));OutlinedTextField(vm.identifier,{vm.identifier=it},label={Text("Employee ID / Email")},singleLine=true,modifier=Modifier.fillMaxWidth())
  Spacer(Modifier.height(12.dp));OutlinedTextField(vm.password,{vm.password=it},label={Text("Password")},singleLine=true,modifier=Modifier.fillMaxWidth())
  if(error!=null)Text(error,color=MaterialTheme.colorScheme.error,fontSize=13.sp)
  Spacer(Modifier.height(18.dp));Button(vm::login,enabled=!loading&&vm.identifier.isNotBlank()&&vm.password.isNotBlank(),modifier=Modifier.fillMaxWidth().height(52.dp),shape=RoundedCornerShape(14.dp)){Text(if(loading)"Signing in…" else "Sign In",fontWeight=FontWeight.Bold)}
 }
}
private fun nav(role:String)=when(role.uppercase()){ "EMPLOYEE"->listOf("Portal","Clock","Chat","Pay","More");"MANAGER"->listOf("Home","Team","Requests","Chat","More");"CO_ADMIN","HR"->listOf("Home","People","Requests","Chat","More");else->listOf("Home","People","Attend","Chat","More") }

@Composable private fun Shell(vm:HrmViewModel,name:String,role:String){
 var tab by remember{mutableStateOf(0)};var morePage by remember{mutableStateOf<String?>(null)};val items=nav(role)
 Scaffold(bottomBar={NavigationBar(containerColor=Color(0xE60F172A), tonalElevation=0.dp){items.forEachIndexed{i,x->NavigationBarItem(i==tab,{tab=i},icon={Text(if(i==tab)"●" else "○",color=if(i==tab)Red else Muted)},label={Text(x,fontSize=11.sp,fontWeight=if(i==tab)FontWeight.Bold else FontWeight.Normal)},colors=NavigationBarItemDefaults.colors(selectedIconColor=Red,selectedTextColor=Red,indicatorColor=Red.copy(.10f)))}}}){p->
  when(items[tab]){"People","Team"->People(vm,p);"Attend","Clock"->Attendance(vm,p);"Requests"->Requests(vm,role,p);"Chat"->Chat(vm,p);"Pay"->Payroll(vm,p);"More"->More(role,p){ f,pp-> if(f=="Notifications") Notifications(vm,pp) else Profile(vm,pp) };"Portal"->Portal(name,role,p);else->Dashboard(vm,name,role,p)}
 }
}
@Composable private fun Dashboard(vm:HrmViewModel,name:String,role:String,p:PaddingValues){
 Column(Modifier.fillMaxSize().padding(p).padding(18.dp)){Text("Welcome",color=Red,fontWeight=FontWeight.Bold);Text(name,fontSize=29.sp,fontWeight=FontWeight.Black,color=Ink);Text(role.replace('_',' '),color=Muted);Spacer(Modifier.height(20.dp))
  BoxCard("Today"){Text("Attendance",fontWeight=FontWeight.Bold,fontSize=18.sp);Text("Track check-in, check-out and attendance status from the HRM server.",color=Muted);Spacer(Modifier.height(10.dp));Button({vm.loadAttendance()}){Text("Refresh attendance")}}
  Spacer(Modifier.height(14.dp));BoxCard("HRM"){Text("Workforce, leave, payroll and communication");Text("Available modules follow your server-side role permissions.",color=Muted,fontSize=13.sp)}
  Spacer(Modifier.height(18.dp));OutlinedButton(vm::logout,Modifier.fillMaxWidth()){Text("Sign out")}
 }
}
@Composable private fun Portal(name:String,role:String,p:PaddingValues){Column(Modifier.fillMaxSize().padding(p).padding(18.dp)){Text("Employee Portal",color=Red,fontWeight=FontWeight.Bold);Text(name,fontSize=29.sp,fontWeight=FontWeight.Black,color=Ink);Text(role.replace('_',' '),color=Muted);Spacer(Modifier.height(18.dp));BoxCard("My HRM"){Text("Attendance");Text("Clock in/out and review attendance.",color=Muted);Spacer(Modifier.height(8.dp));Text("Leave");Text("Submit and track leave requests.",color=Muted);Spacer(Modifier.height(8.dp));Text("Payroll");Text("Review salary information.",color=Muted)}}}
@Composable private fun People(vm:HrmViewModel,p:PaddingValues){val es by vm.employees.collectAsState();LaunchedEffect(Unit){vm.loadEmployees()};Column(Modifier.fillMaxSize().padding(p).padding(18.dp)){Text("Workforce",color=Red,fontWeight=FontWeight.Bold);Text("People",fontSize=29.sp,fontWeight=FontWeight.Black,color=Ink);Spacer(Modifier.height(12.dp));LazyColumn(verticalArrangement=Arrangement.spacedBy(8.dp)){items(es,key={it.id}){e->EmployeeCard(e)}}}}
@Composable private fun EmployeeCard(e:Employee){Card(Modifier.fillMaxWidth(),shape=RoundedCornerShape(18.dp),colors=CardDefaults.cardColors(containerColor=Card)){Column(Modifier.padding(16.dp)){Text(e.full_name,fontWeight=FontWeight.Bold,fontSize=17.sp,color=Ink);Text(e.employee_code?:e.id,color=Red,fontSize=12.sp);Text(listOfNotNull(e.designation,e.department,e.unit_name).joinToString(" • "),color=Muted,fontSize=13.sp);e.email?.let{Text(it,color=Muted,fontSize=12.sp)}}}}
private fun lastKnownLocation(context:Context):Location?{
 if(ContextCompat.checkSelfPermission(context,Manifest.permission.ACCESS_FINE_LOCATION)!=PackageManager.PERMISSION_GRANTED &&
    ContextCompat.checkSelfPermission(context,Manifest.permission.ACCESS_COARSE_LOCATION)!=PackageManager.PERMISSION_GRANTED) return null
 val lm=context.getSystemService(Context.LOCATION_SERVICE) as LocationManager
 return lm.getProviders(true).asSequence().mapNotNull{runCatching{lm.getLastKnownLocation(it)}.getOrNull()}.maxByOrNull{it.time}
}
@Composable private fun Attendance(vm:HrmViewModel,p:PaddingValues){
 val context=LocalContext.current
 val rs by vm.attendance.collectAsState();Column(Modifier.fillMaxSize().padding(p).padding(18.dp)){Text("Attendance",color=Red,fontWeight=FontWeight.Bold);Text("Clock",fontSize=29.sp,fontWeight=FontWeight.Black,color=Ink);Spacer(Modifier.height(12.dp));BoxCard("Server-authoritative attendance"){Text("The server validates attendance policy, timing and geofence.",color=Muted);Spacer(Modifier.height(12.dp));Row(horizontalArrangement=Arrangement.spacedBy(8.dp)){Button({lastKnownLocation(context)?.let{vm.recordAttendance("check_in",it.latitude,it.longitude)} ?: vm.recordAttendance("check_in",null,null)}){Text("Check in")};OutlinedButton({lastKnownLocation(context)?.let{vm.recordAttendance("check_out",it.latitude,it.longitude)} ?: vm.recordAttendance("check_out",null,null)}){Text("Check out")}}};Spacer(Modifier.height(14.dp));Text("Recent records",fontWeight=FontWeight.Bold);LazyColumn(verticalArrangement=Arrangement.spacedBy(8.dp)){items(rs,key={it.id}){r->Card(Modifier.fillMaxWidth(),colors=CardDefaults.cardColors(containerColor=Card),shape=RoundedCornerShape(14.dp)){Row(Modifier.padding(14.dp).fillMaxWidth(),horizontalArrangement=Arrangement.SpaceBetween){Column{Text(r.type?:r.attendance_type?:"Attendance",fontWeight=FontWeight.Bold);Text(r.occurred_at,color=Muted,fontSize=12.sp)};if(r.is_late)Text("+"+r.late_minutes+" min",color=Red,fontWeight=FontWeight.Bold)}}}}}}}
@Composable private fun Requests(vm:HrmViewModel,role:String,p:PaddingValues){
 val leaves by vm.leaves.collectAsState()
 var type by remember{mutableStateOf("Annual Leave")};var start by remember{mutableStateOf("")};var end by remember{mutableStateOf("")}
 LaunchedEffect(Unit){vm.loadLeaves()}
 Column(Modifier.fillMaxSize().padding(p).padding(18.dp)){
  Text("Requests",color=Red,fontWeight=FontWeight.Bold);Text("Leave Requests",fontSize=29.sp,fontWeight=FontWeight.Black,color=Ink);Spacer(Modifier.height(12.dp))
  BoxCard("New request"){OutlinedTextField(type,{type=it},label={Text("Leave type")},singleLine=true,modifier=Modifier.fillMaxWidth());Spacer(Modifier.height(8.dp));OutlinedTextField(start,{start=it},label={Text("Start date YYYY-MM-DD")},singleLine=true,modifier=Modifier.fillMaxWidth());Spacer(Modifier.height(8.dp));OutlinedTextField(end,{end=it},label={Text("End date YYYY-MM-DD")},singleLine=true,modifier=Modifier.fillMaxWidth());Spacer(Modifier.height(10.dp));Button({vm.createLeave(type,start,end)},enabled=start.isNotBlank()&&end.isNotBlank()){Text("Submit request")}}
  Spacer(Modifier.height(14.dp));Text("My requests",fontWeight=FontWeight.Bold);Spacer(Modifier.height(7.dp));LazyColumn(verticalArrangement=Arrangement.spacedBy(8.dp)){items(leaves,key={it.id}){l->Card(Modifier.fillMaxWidth(),colors=CardDefaults.cardColors(containerColor=Card),shape=RoundedCornerShape(14.dp)){Column(Modifier.padding(14.dp)){Text(l.leave_type?:"Leave",fontWeight=FontWeight.Bold);Text((l.start_date?:"")+" → "+(l.end_date?:""),color=Muted);Text(l.status,color=if(l.status=="REJECTED")Red else Muted,fontSize=12.sp);if(role.uppercase()==l.current_approver_role&&l.status!="APPROVED"&&l.status!="REJECTED"){Spacer(Modifier.height(10.dp));Row(horizontalArrangement=Arrangement.spacedBy(8.dp)){Button({vm.updateLeave(l.id,when(l.current_approver_role){"MANAGER"->"MANAGER_APPROVED";"HR"->"HR_APPROVED";"CO_ADMIN"->"CO_ADMIN_APPROVED";"ADMIN"->"APPROVED";else->"APPROVED"})}){Text("Approve")};OutlinedButton({vm.updateLeave(l.id,"REJECTED")}){Text("Reject")}}}}}}}
 }
}
@Composable private fun Payroll(vm:HrmViewModel,p:PaddingValues){
 val salaries by vm.salaries.collectAsState();LaunchedEffect(Unit){vm.loadSalaries()}
 Column(Modifier.fillMaxSize().padding(p).padding(18.dp)){Text("Payroll",color=Red,fontWeight=FontWeight.Bold);Text("Salary",fontSize=29.sp,fontWeight=FontWeight.Black,color=Ink);Spacer(Modifier.height(12.dp));LazyColumn(verticalArrangement=Arrangement.spacedBy(8.dp)){items(salaries,key={it.id}){s->Card(Modifier.fillMaxWidth(),colors=CardDefaults.cardColors(containerColor=Card),shape=RoundedCornerShape(16.dp)){Column(Modifier.padding(16.dp)){Text(s.period?:"Salary period",fontWeight=FontWeight.Bold);Text("Base: "+(s.base_salary?:0.0),color=Muted);Text("Net: "+(s.net_salary?:0.0),fontWeight=FontWeight.Black);Text(s.status?:s.period_status?:"",color=Muted,fontSize=12.sp)}}}}}
}
@Composable private fun More(role:String,p:PaddingValues,onSelect:(String,PaddingValues)->Unit){val fs=when(role.uppercase()){"EMPLOYEE"->listOf("Profile","Attendance","Leave Requests","Payroll","Chat","Notifications","Settings");"MANAGER"->listOf("Team","Attendance","Requests","Duty Roster","Schedule Changes","Chat","Notifications","Settings");"CO_ADMIN","HR"->listOf("People","Attendance","Requests","Payroll","Leave Policy","Duty Roster","Chat","Broadcast","Activity","Settings");else->listOf("People","Attendance","Tracking","Payroll","Requests","Infrastructure","Security Logs","Activity","Assets","Permissions","Approval Flow","Unit Approval Config","Role Capabilities","Custom Roles","Leave Policy","Duty Replacement","Schedule Changes","Roster","Designation Admin","Broadcast","Chat","System Settings")};Column(Modifier.fillMaxSize().padding(p).padding(18.dp)){Text("More",color=Red,fontWeight=FontWeight.Bold);Text("HRM Modules",fontSize=29.sp,fontWeight=FontWeight.Black,color=Ink);Text("Role: "+role.replace('_',' '),color=Muted);Spacer(Modifier.height(12.dp));LazyColumn(verticalArrangement=Arrangement.spacedBy(7.dp)){items(fs){f->Card(Modifier.fillMaxWidth(),shape=RoundedCornerShape(15.dp),colors=CardDefaults.cardColors(containerColor=Card)){TextButton({if(f=="Profile"||f=="Notifications")onSelect(f,p)},Modifier.fillMaxWidth()){Text(f,Modifier.fillMaxWidth().padding(16.dp),fontWeight=FontWeight.SemiBold,color=Ink)}}}}}}

@Composable private fun Notifications(vm:HrmViewModel,p:PaddingValues){
 val ns by vm.notifications.collectAsState()
 LaunchedEffect(Unit){vm.loadNotifications()}
 Column(Modifier.fillMaxSize().padding(p).padding(18.dp)){
  Text("Notifications",color=Red,fontWeight=FontWeight.Bold);Text("Updates",fontSize=29.sp,fontWeight=FontWeight.Black,color=Ink);Spacer(Modifier.height(12.dp))
  LazyColumn(verticalArrangement=Arrangement.spacedBy(8.dp)){items(ns,key={it.id}){n->
   Card(Modifier.fillMaxWidth(),shape=RoundedCornerShape(16.dp),colors=CardDefaults.cardColors(containerColor=Card)){Column(Modifier.padding(16.dp)){
    Text(n.title?:"Notification",fontWeight=FontWeight.Bold);Text(n.message?:n.body.orEmpty(),color=Muted,fontSize=13.sp);Text(n.created_at.orEmpty(),color=Muted,fontSize=11.sp)
    if(n.read_at==null)TextButton({vm.markNotificationRead(n.id)}){Text("Mark as read",color=Red)}
   }}
  }}
 }
}
\n@Composable private fun Profile(vm:HrmViewModel,p:PaddingValues){
 val me by vm.profile.collectAsState()
 var current by remember{mutableStateOf("")};var next by remember{mutableStateOf("")};var confirm by remember{mutableStateOf("")};var message by remember{mutableStateOf("")}
 LaunchedEffect(Unit){if(me==null){vm.loadEmployees()}}
 Column(Modifier.fillMaxSize().padding(p).padding(18.dp)){
  Text("Profile",color=Red,fontWeight=FontWeight.Bold);Text(me?.full_name?:"My Profile",fontSize=29.sp,fontWeight=FontWeight.Black,color=Ink);Text(me?.employee_code?:me?.id.orEmpty(),color=Muted)
  Spacer(Modifier.height(14.dp));BoxCard("Employee information"){
   listOf("Department" to me?.department,"Designation" to me?.designation,"Email" to me?.email,"Status" to me?.status).forEach{(k,v)->Row(Modifier.fillMaxWidth().padding(vertical=5.dp),horizontalArrangement=Arrangement.SpaceBetween){Text(k,fontWeight=FontWeight.SemiBold);Text(v?: "—",color=Muted)}}
  }
  Spacer(Modifier.height(14.dp));BoxCard("Change password"){
   OutlinedTextField(current,{current=it},label={Text("Current password")},singleLine=true,modifier=Modifier.fillMaxWidth());Spacer(Modifier.height(8.dp))
   OutlinedTextField(next,{next=it},label={Text("New password")},singleLine=true,modifier=Modifier.fillMaxWidth());Spacer(Modifier.height(8.dp))
   OutlinedTextField(confirm,{confirm=it},label={Text("Confirm password")},singleLine=true,modifier=Modifier.fillMaxWidth());Spacer(Modifier.height(10.dp))
   Button({if(next.length<8)message="Password must be at least 8 characters" else if(next!=confirm)message="Passwords do not match" else {vm.changePassword(current,next);message="Password update submitted"}},enabled=next.isNotBlank()&&confirm.isNotBlank()){Text("Update password")}
   if(message.isNotBlank())Text(message,color=if(message.contains("submitted"))Red else MaterialTheme.colorScheme.error,fontSize=12.sp,modifier=Modifier.padding(top=8.dp))
  }
 }
}
