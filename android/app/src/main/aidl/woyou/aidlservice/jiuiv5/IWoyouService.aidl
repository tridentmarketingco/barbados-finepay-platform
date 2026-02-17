package woyou.aidlservice.jiuiv5;

import woyou.aidlservice.jiuiv5.ICallback;

/**
 * Sunmi Printer AIDL Interface
 * Official interface for Sunmi built-in thermal printers
 * 
 * This is the standard AIDL interface provided by Sunmi for all their POS devices.
 * Compatible with: V2, V2 Pro, T2, T2 Lite, P2, P2 Pro, and other Sunmi devices
 * 
 * Documentation: https://docs.sunmi.com
 */
interface IWoyouService {
    
    /**
     * Printer initialization
     */
    void printerInit(in ICallback callback);
    
    /**
     * Get printer status
     * Returns: 1=normal, 2=preparing, 3=abnormal communication, 4=out of paper, 
     *          5=overheated, 6=cover open, 7=cutter error, 8=cutter recovered,
     *          9=black mark not detected, 505=printer not detected
     */
    int updatePrinterState();
    
    /**
     * Print text
     * @param text Text to print
     * @param callback Callback for print result
     */
    void printText(String text, in ICallback callback);
    
    /**
     * Print text with specified font
     * @param text Text to print
     * @param typeface Font name (e.g., "monospace", "serif")
     * @param fontSize Font size (default 24)
     * @param callback Callback for print result
     */
    void printTextWithFont(String text, String typeface, int fontSize, in ICallback callback);
    
    /**
     * Print columnar text (for receipts)
     * @param colsTextArr Array of column texts
     * @param colsWidthArr Array of column widths (must sum to 48 for 58mm or 72 for 80mm)
     * @param colsAlign Array of alignments (0=left, 1=center, 2=right)
     * @param callback Callback for print result
     */
    void printColumnsText(in String[] colsTextArr, in int[] colsWidthArr, in int[] colsAlign, in ICallback callback);
    
    /**
     * Print columnar text with custom font
     */
    void printColumnsString(in String[] colsTextArr, in int[] colsWidthArr, in int[] colsAlign, in ICallback callback);
    
    /**
     * Print barcode
     * @param data Barcode data
     * @param symbology Barcode type (0=UPC-A, 1=UPC-E, 2=EAN13, 3=EAN8, 4=CODE39, 
     *                  5=ITF, 6=CODABAR, 7=CODE93, 8=CODE128)
     * @param height Barcode height in pixels (1-255, recommend 162)
     * @param width Barcode width (2-6, recommend 2-3)
     * @param textPosition Text position (0=none, 1=above, 2=below, 3=both)
     * @param callback Callback for print result
     */
    void printBarCode(String data, int symbology, int height, int width, int textPosition, in ICallback callback);
    
    /**
     * Print QR code
     * @param data QR code data (URL or text)
     * @param modulesize Module size (dots per module, 4-16, recommend 6-8 for receipts)
     * @param errorlevel Error correction level (0=L(7%), 1=M(15%), 2=Q(25%), 3=H(30%))
     * @param callback Callback for print result
     */
    void printQRCode(String data, int modulesize, int errorlevel, in ICallback callback);
    
    /**
     * Print original bitmap (1-bit black/white)
     * @param bitmap Bitmap to print
     * @param callback Callback for print result
     */
    void printBitmap(in android.graphics.Bitmap bitmap, in ICallback callback);
    
    /**
     * Print bitmap with specified width
     * @param bitmap Bitmap to print
     * @param width Target width (pixels)
     * @param callback Callback for print result
     */
    void printBitmapCustom(in android.graphics.Bitmap bitmap, int width, in ICallback callback);
    
    /**
     * Set text alignment
     * @param alignment 0=left, 1=center, 2=right
     * @param callback Callback for result
     */
    void setAlignment(int alignment, in ICallback callback);
    
    /**
     * Set font size
     * @param fontSize Font size (default 24)
     * @param callback Callback for result
     */
    void setFontSize(float fontSize, in ICallback callback);
    
    /**
     * Set font name
     * @param typeface Font name
     * @param callback Callback for result
     */
    void setFontName(String typeface, in ICallback callback);
    
    /**
     * Line feed (print newlines)
     * @param lines Number of lines to feed
     * @param callback Callback for result
     */
    void lineWrap(int lines, in ICallback callback);
    
    /**
     * Send RAW ESC/POS commands
     * @param data Raw command bytes
     * @param callback Callback for result
     */
    void sendRAWData(in byte[] data, in ICallback callback);
    
    /**
     * Set printer speed
     * @param speed Speed level (0-9, higher = faster but lower quality)
     * @param callback Callback for result
     */
    void setPrinterSpeed(int speed, in ICallback callback);
    
    /**
     * Get printer serial number
     */
    String getPrinterSerialNo();
    
    /**
     * Get printer version
     */
    String getPrinterVersion();
    
    /**
     * Get service version
     */
    String getServiceVersion();
    
    /**
     * Get printer model
     */
    String getPrinterModal();
    
    /**
     * Get paper specifications
     * Returns: 1=58mm, 2=80mm
     */
    int getPrinterPaper();
    
    /**
     * Cut paper
     * Full cut (completely separates paper)
     * @param callback Callback for result
     */
    void cutPaper(in ICallback callback);
    
    /**
     * Partial cut paper
     * Leaves small connection for easy tear-off
     * @param callback Callback for result
     */
    void partialCutPaper(in ICallback callback);
    
    /**
     * Open cash drawer (if connected)
     * @param callback Callback for result
     */
    void openDrawer(in ICallback callback);
    
    /**
     * Get drawer status
     * Returns: 0=closed, 1=open
     */
    int getDrawerStatus();
    
    /**
     * Transaction mode - Enter printer buffer
     * Use this to queue multiple commands and execute atomically
     * @param clean true=clear buffer before entering, false=keep existing buffer
     * @param callback Callback for result
     */
    void enterPrinterBuffer(boolean clean, in ICallback callback);
    
    /**
     * Transaction mode - Commit printer buffer
     * Executes all queued commands
     * @param callback Callback for result
     */
    void commitPrinterBuffer(in ICallback callback);
    
    /**
     * Transaction mode - Exit printer buffer
     * Discards all queued commands (rollback)
     * @param callback Callback for result
     */
    void exitPrinterBuffer(boolean commit, in ICallback callback);
    
    /**
     * Transaction mode - Exit printer buffer with clear
     * @param callback Callback for result
     */
    void exitPrinterBufferWithCallback(boolean commit, in ICallback callback);
}
