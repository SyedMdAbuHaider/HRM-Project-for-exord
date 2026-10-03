package com.exord.hrm.ui

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.exord.hrm.data.auth.SessionStore
import com.exord.hrm.data.model.*
import com.exord.hrm.data.remote.*
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import java.time.Instant
import java.util.UUID
import retrofit2.HttpException

data class HrmState(val loggedIn:Boolean=false,val name:String="",val role:String="",val loading:Boolean=false,val error:String?=null)

class HrmViewModel(app:Application):AndroidViewModel(app){
 private val sessions=SessionStore(app)
 private val api=ApiFactory.create{currentToken}
 private var currentToken=""
 var identifier=""
 var password=""
 private val _state=MutableStateFlow(HrmState());val state=_state.asStateFlow()
 private val _employees=MutableStateFlow<List<Employee>>(emptyList());val employees=_employees.asStateFlow()
 private val _attendance=MutableStateFlow<List<AttendanceRecord>>(emptyList());val attendance=_attendance.asStateFlow()
 private val _leaves=MutableStateFlow<List<LeaveRequest>>(emptyList());val leaves=_leaves.asStateFlow()
 private val _salaries=MutableStateFlow<List<SalaryRecord>>(emptyList());val salaries=_salaries.asStateFlow()
 private val _notifications=MutableStateFlow<List<NotificationRecord>>(emptyList());val notifications=_notifications.asStateFlow()

 init{viewModelScope.launch{currentToken=sessions.accessToken();if(currentToken.isNotBlank())bootstrap()}}

 fun login(){viewModelScope.launch{_state.value=HrmState(loading=true);try{val r=api.login(LoginRequest(identifier.trim(),password));currentToken=r.accessToken;sessions.save(r.accessToken,r.refreshToken);bootstrap()}catch(e:Exception){_state.value=HrmState(error=e.message?:"Unable to sign in")}}}

 private suspend fun bootstrap(){try{val me=api.me().data?:throw IllegalStateException("Employee profile not found");_state.value=HrmState(true,me.full_name,me.role.orEmpty());loadAttendance();loadLeaves();loadSalaries();loadNotifications()}catch(e:Exception){sessions.clear();currentToken="";_state.value=HrmState(error="Session expired")}}

 fun loadEmployees(){viewModelScope.launch{try{_employees.value=api.employees().employees}catch(_:Exception){}}}
 fun loadLeaves(){viewModelScope.launch{try{_leaves.value=api.leaves().leaves}catch(_:Exception){}}}
 fun createLeave(type:String,start:String,end:String,reason:String=""){viewModelScope.launch{try{api.createLeave(LeaveCreateRequest(type,start,end,reason.ifBlank{null}));loadLeaves()}catch(e:Exception){_state.value=_state.value.copy(error=e.message?:"Leave request failed")}}}
 fun loadSalaries(){viewModelScope.launch{try{_salaries.value=api.salaries().salaries}catch(_:Exception){}}}
 fun updateLeave(id:String,status:String,rejectionReason:String?=null){viewModelScope.launch{try{api.updateLeave(id,mapOf("status" to status,"rejectionReason" to rejectionReason));loadLeaves()}catch(e:Exception){_state.value=_state.value.copy(error=e.message?:"Leave approval failed")}}}
 fun loadNotifications(){viewModelScope.launch{try{_notifications.value=api.notifications().notifications}catch(_:Exception){}}}
 fun markNotificationRead(id:String){viewModelScope.launch{try{api.markNotificationRead(id);loadNotifications()}catch(_:Exception){}}}
 fun loadAttendance(){viewModelScope.launch{try{_attendance.value=api.attendance().records}catch(_:Exception){} }}

 fun recordAttendance(type:String,latitude:Double?=null,longitude:Double?=null){viewModelScope.launch{try{api.recordAttendance(AttendanceRequest(type,Instant.now().toString(),location=if(latitude!=null&&longitude!=null)mapOf("latitude" to latitude,"longitude" to longitude)else null,clientEventId=UUID.randomUUID().toString(),appVersion="android-native"));loadAttendance()}catch(e:Exception){_state.value=_state.value.copy(error=e.message?: "Attendance request failed")}}}

 fun logout(){viewModelScope.launch{try{if(currentToken.isNotBlank())api.logout(RefreshRequest(sessions.refreshToken()))}catch(_:Exception){};sessions.clear();currentToken="";_employees.value=emptyList();_attendance.value=emptyList();_leaves.value=emptyList();_salaries.value=emptyList();_notifications.value=emptyList();_state.value=HrmState()}}

 companion object{fun factory(app:Application)=object:androidx.lifecycle.ViewModelProvider.Factory{override fun <T:androidx.lifecycle.ViewModel>create(c:Class<T>):T=HrmViewModel(app) as T}}
}
