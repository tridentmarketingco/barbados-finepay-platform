package woyou.aidlservice.jiuiv5;

/**
 * Sunmi Printer Callback Interface
 * Used for asynchronous feedback from printer operations
 * 
 * All printer operations are asynchronous and return results via this callback.
 */
interface ICallback {
    
    /**
     * Callback when operation completes
     * 
     * @param isSuccess true if operation succeeded, false if failed
     */
    void onRunResult(boolean isSuccess);
    
    /**
     * Callback with return data
     * 
     * @param data Return data from operation (format depends on operation)
     */
    void onReturnString(String data);
    
    /**
     * Callback when print job completes
     * 
     * @param isSuccess true if print succeeded, false if failed
     */
    void onPrintResult(boolean isSuccess);
}
