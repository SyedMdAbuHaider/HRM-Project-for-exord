package com.exord.hrm.data.model
import kotlinx.serialization.Serializable
@Serializable data class Employee(val id:String,val employee_code:String?=null,val full_name:String,val email:String?=null,val role:String?=null,val department:String?=null,val unit_name:String?=null,val designation:String?=null,val status:String?=null,val avatar_url:String?=null)
@Serializable data class MeResponse(val data:Employee?=null)
@Serializable data class AttendanceRecord(val id:String,val employee_id:String,val type:String?=null,val attendance_type:String?=null,val occurred_at:String,val is_late:Boolean=false,val late_minutes:Int=0)
@Serializable data class LeaveRequest(val id:String,val employee_id:String,val leave_type:String?=null,val start_date:String?=null,val end_date:String?=null,val status:String,val reason:String?=null,val current_approver_role:String?=null,val user_name:String?=null,val employee_code:String?=null)

@kotlinx.serialization.Serializable data class SalaryRecord(val id:String,val employee_id:String,val period:String?=null,val period_status:String?=null,val gross_salary:Double?=null,val net_salary:Double?=null,val base_salary:Double?=null,val total_earnings:Double?=null,val total_deductions:Double?=null,val full_name:String?=null,val employee_code:String?=null)
