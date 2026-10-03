package com.exord.hrm.data.remote
import kotlinx.serialization.Serializable
import retrofit2.http.Body
import retrofit2.http.POST
import retrofit2.http.GET
import com.exord.hrm.data.model.Employee
import com.exord.hrm.data.model.MeResponse

@Serializable data class LoginRequest(val identifier:String,val password:String)
@Serializable data class LoginResponse(val accessToken:String,val refreshToken:String,val expiresIn:Int,val mustChangePassword:Boolean=false)
@Serializable data class ApiError(val error:String)
@Serializable data class RefreshRequest(val refreshToken:String)
@Serializable data class RefreshResponse(val accessToken:String,val refreshToken:String,val expiresIn:Int)
@Serializable data class AttendanceRequest(val type:String,val timestamp:String,val location:Map<String,Double>?=null,val deviceId:String?=null,val appVersion:String?=null,val clientEventId:String?=null)
@Serializable data class AttendanceResponse(val record:com.exord.hrm.data.model.AttendanceRecord)
@Serializable data class AttendanceListResponse(val records:List<com.exord.hrm.data.model.AttendanceRecord>)
@Serializable data class EmployeesResponse(val employees:List<Employee>,val limit:Int=100,val offset:Int=0)
@Serializable data class LeavesResponse(val leaves:List<com.exord.hrm.data.model.LeaveRequest>)
@Serializable data class LeaveResponse(val leave:com.exord.hrm.data.model.LeaveRequest)
@Serializable data class SalariesResponse(val salaries:List<com.exord.hrm.data.model.SalaryRecord>)
@Serializable data class NotificationRecord(val id:String,val title:String?=null,val message:String?=null,val body:String?=null,val read_at:String?=null,val created_at:String?=null)
@Serializable data class NotificationsResponse(val notifications:List<NotificationRecord>)

@Serializable data class LeaveCreateRequest(val leaveType:String,val startDate:String,val endDate:String,val reason:String?=null)
interface HrmApi {
 @GET("api/v1/me") suspend fun me(): MeResponse
 @POST("api/v1/auth/login") suspend fun login(@Body request:LoginRequest): LoginResponse
 @POST("api/v1/auth/refresh") suspend fun refresh(@Body request:RefreshRequest): RefreshResponse
 @POST("api/v1/auth/logout") suspend fun logout(@Body request:RefreshRequest)
 @GET("api/v1/hrm/employees") suspend fun employees(@retrofit2.http.Query("limit") limit:Int=100,@retrofit2.http.Query("offset") offset:Int=0): EmployeesResponse
 @GET("api/v1/attendance") suspend fun attendance(@retrofit2.http.Query("limit") limit:Int=50): AttendanceListResponse
 @POST("api/v1/attendance") suspend fun recordAttendance(@Body request:AttendanceRequest): AttendanceResponse
 @GET("api/v1/hrm/leaves") suspend fun leaves():LeavesResponse
 @POST("api/v1/hrm/leaves") suspend fun createLeave(@Body body:LeaveCreateRequest):LeaveResponse
 @GET("api/v1/hrm/salaries") suspend fun salaries():SalariesResponse
 @GET("api/v1/hrm/notifications") suspend fun notifications():NotificationsResponse
 @POST("api/v1/hrm/notifications/{id}/read") suspend fun markNotificationRead(@retrofit2.http.Path("id") id:String)
}