package com.payfine.warden.models

import org.json.JSONObject
import java.text.SimpleDateFormat
import java.util.*

/**
 * Offence Ticket Data Class
 * Matches the backend Ticket model structure
 * 
 * This data class represents a traffic ticket with all necessary information
 * for printing thermal receipts on Sunmi POS devices.
 * 
 * SUPPORTS MULTIPLE FORMATS:
 * - New format (from requirements): title, amount, plate, date, warden, location
 * - Legacy format (from web portal): serialNumber, offenceDesc, etc.
 */
data class OffenceTicket(
    // New format fields (from requirements)
    val title: String = "PAYFINE TICKET",
    val amount: String = "0.00",
    val plate: String? = null,
    val date: String? = null,
    val warden: String? = null,
    val location: String? = null,
    
    // Legacy fields (for backward compatibility)
    val serialNumber: String = "",
    val offenceDesc: String = "",
    val dateTime: String = "",
    val dueDate: String? = null,
    val officerBadge: String? = null,
    val driverName: String? = null,
    val driverLicense: String? = null,
    val points: Int = 0,
    val courtRequired: Boolean = false,
    val isRepeatOffence: Boolean = false,
    val qrUrl: String = "",
    val governmentName: String = "Government Authority",
    val contactEmail: String = "support@payfine.example.com",
    val contactPhone: String? = null
) {
    
    companion object {
        /**
         * Create OffenceTicket from JSON object
         * Supports both new and legacy formats
         * 
         * NEW FORMAT (from requirements):
         * {
         *   "title": "PAYFINE TICKET",
         *   "amount": "50.00",
         *   "plate": "ABC123",
         *   "date": "2026-02-09",
         *   "warden": "DJ Blank",
         *   "location": "Bridgetown"
         * }
         * 
         * LEGACY FORMAT (backward compatible):
         * {
         *   "serialNumber": "A123456",
         *   "offenceDesc": "Speeding 15 km/h over limit",
         *   "amount": 150.00,
         *   ...
         * }
         */
        fun fromJson(json: JSONObject): OffenceTicket {
            // Check if new format (has 'title' field)
            return if (json.has("title")) {
                OffenceTicket(
                    title = json.optString("title", "PAYFINE TICKET"),
                    amount = json.optString("amount", "0.00"),
                    plate = json.optString("plate", null),
                    date = json.optString("date", null),
                    warden = json.optString("warden", null),
                    location = json.optString("location", null),
                    // Generate serial for QR code
                    serialNumber = json.optString("serialNumber", generateSerial()),
                    qrUrl = json.optString("qrUrl", "https://payfine.example.com/pay?id=${generateSerial()}")
                )
            } else {
                // Legacy format
                val serial = json.optString("serialNumber", generateSerial())
                OffenceTicket(
                    serialNumber = serial,
                    offenceDesc = json.optString("offenceDesc", ""),
                    amount = json.optDouble("amount", 0.0).toString(),
                    dateTime = json.optString("dateTime", ""),
                    date = json.optString("date", null),
                    dueDate = json.optString("dueDate", null),
                    officerBadge = json.optString("officerBadge", null),
                    driverName = json.optString("driverName", null),
                    driverLicense = json.optString("driverLicense", null),
                    points = json.optInt("points", 0),
                    courtRequired = json.optBoolean("courtRequired", false),
                    isRepeatOffence = json.optBoolean("isRepeatOffence", false),
                    qrUrl = json.optString("qrUrl", "https://payfine.example.com/pay?serial=$serial"),
                    governmentName = json.optString("governmentName", "Government Authority"),
                    contactEmail = json.optString("contactEmail", "support@payfine.example.com"),
                    contactPhone = json.optString("contactPhone", null)
                )
            }
        }
        
        /**
         * Generate a simple serial number for tickets without one
         */
        private fun generateSerial(): String {
            val timestamp = System.currentTimeMillis()
            val random = (1000..9999).random()
            return "TKT-$timestamp-$random"
        }
    }
    
    /**
     * Get formatted amount for display
     */
    fun getFormattedAmount(): String {
        return try {
            val amountValue = amount.toDoubleOrNull() ?: 0.0
            String.format("$%.2f", amountValue)
        } catch (e: Exception) {
            "$$amount"
        }
    }
    
    /**
     * Get formatted date for display
     */
    fun getFormattedDate(): String {
        return date ?: dateTime ?: SimpleDateFormat("MMM dd, yyyy", Locale.getDefault()).format(Date())
    }
    
    /**
     * Get serial number for barcode/QR
     */
    fun getSerialNumber(): String {
        return serialNumber.ifEmpty {
            // Generate from date and plate if available
            "${plate ?: "TKT"}-${System.currentTimeMillis()}"
        }
    }
    
    /**
     * Convert to JSON for logging/debugging
     */
    fun toJson(): JSONObject {
        return JSONObject().apply {
            put("title", title)
            put("amount", amount)
            put("plate", plate)
            put("date", date)
            put("warden", warden)
            put("location", location)
            put("serialNumber", serialNumber)
            put("offenceDesc", offenceDesc)
            put("dateTime", dateTime)
            put("dueDate", dueDate)
            put("officerBadge", officerBadge)
            put("driverName", driverName)
            put("driverLicense", driverLicense)
            put("points", points)
            put("courtRequired", courtRequired)
            put("isRepeatOffence", isRepeatOffence)
            put("qrUrl", qrUrl)
            put("governmentName", governmentName)
            put("contactEmail", contactEmail)
            put("contactPhone", contactPhone)
        }
    }
}
