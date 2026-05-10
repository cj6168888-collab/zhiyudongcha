package com.xiaozhi.companion

import android.content.Context
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.ImageView
import android.widget.TextView
import androidx.recyclerview.widget.RecyclerView

class PermissionGuideAdapter(
    private val context: Context,
    private val totalSteps: Int
) : RecyclerView.Adapter<PermissionGuideAdapter.PermissionStepViewHolder>() {

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): PermissionStepViewHolder {
        val view = LayoutInflater.from(context).inflate(R.layout.item_permission_step, parent, false)
        return PermissionStepViewHolder(view)
    }

    override fun onBindViewHolder(holder: PermissionStepViewHolder, position: Int) {
        holder.bind(position)
    }

    override fun getItemCount(): Int = totalSteps

    inner class PermissionStepViewHolder(itemView: View) : RecyclerView.ViewHolder(itemView) {
        private val iconImage: ImageView = itemView.findViewById(R.id.stepIcon)
        private val titleText: TextView = itemView.findViewById(R.id.stepTitle)
        private val descriptionText: TextView = itemView.findViewById(R.id.stepDescription)

        fun bind(position: Int) {
            val (icon, title, description) = when (position) {
                0 -> Triple(
                    R.drawable.ic_microphone,
                    context.getString(R.string.step_microphone_title),
                    context.getString(R.string.step_microphone_description)
                )
                1 -> Triple(
                    R.drawable.ic_storage,
                    context.getString(R.string.step_storage_title),
                    context.getString(R.string.step_storage_description)
                )
                2 -> Triple(
                    R.drawable.ic_notification,
                    context.getString(R.string.step_notification_title),
                    context.getString(R.string.step_notification_description)
                )
                3 -> Triple(
                    R.drawable.ic_battery,
                    context.getString(R.string.step_battery_title),
                    context.getString(R.string.step_battery_description)
                )
                4 -> Triple(
                    R.drawable.ic_accessibility,
                    context.getString(R.string.step_accessibility_title),
                    context.getString(R.string.step_accessibility_description)
                )
                5 -> Triple(
                    R.drawable.ic_notification_listener,
                    context.getString(R.string.step_listener_title),
                    context.getString(R.string.step_listener_description)
                )
                else -> Triple(0, "", "")
            }

            iconImage.setImageResource(icon)
            titleText.text = title
            descriptionText.text = description
        }
    }
}
