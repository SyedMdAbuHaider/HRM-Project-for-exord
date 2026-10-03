package com.exord.hrm.data.model

import kotlinx.serialization.Serializable

@Serializable data class Conversation(
    val id:String,
    val type:String,
    val department_id:String?=null,
    val name:String?=null,
    val is_private:Boolean=false,
    val created_by:String?=null,
    val created_at:String?=null,
    val updated_at:String?=null
)
@Serializable data class ConversationMember(
    val conversation_id:String,
    val employee_id:String,
    val hidden_at:String?=null,
    val last_read_at:String?=null
)
@Serializable data class ChatMessage(
    val id:String,
    val conversation_id:String,
    val sender_id:String,
    val content:String?=null,
    val file_url:String?=null,
    val file_type:String?=null,
    val file_name:String?=null,
    val file_size:Long?=null,
    val reply_to_id:String?=null,
    val is_deleted:Boolean=false,
    val edited_at:String?=null,
    val created_at:String?=null
)
