/**
 * Sunmi Printer Bridge
 * JavaScript interface to communicate with Android native printer
 * 
 * This module provides a clean API for the web app to interact with
 * the Sunmi thermal printer via the Android WebView bridge.
 * 
 * USAGE:
 * import { printTicket, getPrinterStatus, testPrint } from './sunmiPrinterBridge';
 * 
 * // Print a ticket
 * const success = await printTicket(ticketData);
 * 
 * // Check printer status
 * const status = await getPrinterStatus();
 * console.log(status.isReady); // true/false
 */

/**
 * Check if running in Sunmi Android app
 * @returns {boolean} True if SunmiPrinter bridge is available
 */
export const isSunmiDevice = () => {
  return typeof window !== 'undefined' && 
         typeof window.SunmiPrinter !== 'undefined';
};

/**
 * Print a traffic ticket
 * 
 * @param {Object} ticketData - Ticket information
 * @param {string} ticketData.serialNumber - Ticket serial number (e.g., "A123456")
 * @param {string} ticketData.offenceDesc - Offence description
 * @param {string} ticketData.location - Location of offence
 * @param {string} ticketData.plate - Vehicle plate number
 * @param {number} ticketData.amount - Fine amount
 * @param {string} ticketData.dateTime - ISO datetime string
 * @param {string} ticketData.dueDate - Due date (YYYY-MM-DD)
 * @param {string} ticketData.officerBadge - Officer badge number
 * @param {string} ticketData.driverName - Driver name
 * @param {string} ticketData.driverLicense - Driver license number
 * @param {number} ticketData.points - Demerit points
 * @param {boolean} ticketData.courtRequired - Court appearance required
 * @param {boolean} ticketData.isRepeatOffence - Is repeat offence
 * @param {string} ticketData.qrUrl - Payment QR code URL
 * @param {string} ticketData.governmentName - Government name for header
 * @param {string} ticketData.contactEmail - Contact email
 * @param {string} ticketData.contactPhone - Contact phone
 * 
 * @returns {Promise<boolean>} True if print succeeded
 */
export const printTicket = async (ticketData) => {
  if (!isSunmiDevice()) {
    console.warn('Not running on Sunmi device - print skipped');
    return false;
  }

  try {
    // Validate required fields
    if (!ticketData.serialNumber || !ticketData.offenceDesc || !ticketData.amount) {
      throw new Error('Missing required ticket fields: serialNumber, offenceDesc, amount');
    }

    // Prepare ticket data for Android
    const androidTicket = {
      serialNumber: ticketData.serialNumber,
      offenceDesc: ticketData.offenceDesc,
      location: ticketData.location || '',
      plate: ticketData.plate || '',
      amount: parseFloat(ticketData.amount),
      dateTime: ticketData.dateTime || new Date().toISOString(),
      dueDate: ticketData.dueDate || '',
      officerBadge: ticketData.officerBadge || '',
      driverName: ticketData.driverName || '',
      driverLicense: ticketData.driverLicense || '',
      points: parseInt(ticketData.points) || 0,
      courtRequired: Boolean(ticketData.courtRequired),
      isRepeatOffence: Boolean(ticketData.isRepeatOffence),
      qrUrl: ticketData.qrUrl || `https://payfine.example.com/pay?serial=${ticketData.serialNumber}`,
      governmentName: ticketData.governmentName || 'Government Authority',
      contactEmail: ticketData.contactEmail || 'support@payfine.example.com',
      contactPhone: ticketData.contactPhone || ''
    };

    console.log('Printing ticket via Sunmi bridge:', androidTicket);

    // Call Android bridge
    const success = window.SunmiPrinter.printTicket(JSON.stringify(androidTicket));
    
    return success;
  } catch (error) {
    console.error('Error printing ticket:', error);
    throw error;
  }
};

/**
 * Get printer status
 * 
 * @returns {Promise<Object>} Printer status object
 * @property {number} status - Status code (1=ready, 4=out of paper, etc.)
 * @property {string} statusText - Human-readable status
 * @property {boolean} isReady - True if printer is ready to print
 * @property {number} timestamp - Status timestamp
 */
export const getPrinterStatus = async () => {
  if (!isSunmiDevice()) {
    return {
      status: 505,
      statusText: 'Not on Sunmi device',
      isReady: false,
      timestamp: Date.now()
    };
  }

  try {
    const statusJson = window.SunmiPrinter.getPrinterStatus();
    return JSON.parse(statusJson);
  } catch (error) {
    console.error('Error getting printer status:', error);
    return {
      status: 505,
      statusText: 'Error',
      isReady: false,
      timestamp: Date.now()
    };
  }
};

/**
 * Check if printer is ready
 * 
 * @returns {Promise<boolean>} True if printer is ready
 */
export const isPrinterReady = async () => {
  if (!isSunmiDevice()) {
    return false;
  }

  try {
    return window.SunmiPrinter.isPrinterReady();
  } catch (error) {
    console.error('Error checking printer ready:', error);
    return false;
  }
};

/**
 * Get printer status text
 * 
 * @returns {Promise<string>} Human-readable status text
 */
export const getPrinterStatusText = async () => {
  if (!isSunmiDevice()) {
    return 'Not on Sunmi device';
  }

  try {
    return window.SunmiPrinter.getPrinterStatusText();
  } catch (error) {
    console.error('Error getting printer status text:', error);
    return 'Error';
  }
};

/**
 * Print test receipt
 * Useful for verifying printer functionality
 * 
 * @returns {Promise<boolean>} True if test print succeeded
 */
export const testPrint = async () => {
  if (!isSunmiDevice()) {
    console.warn('Not running on Sunmi device - test print skipped');
    return false;
  }

  try {
    return window.SunmiPrinter.testPrint();
  } catch (error) {
    console.error('Error printing test receipt:', error);
    return false;
  }
};

/**
 * Wait for printer to be ready
 * Polls printer status until ready or timeout
 * 
 * @param {number} timeoutMs - Timeout in milliseconds (default 10000)
 * @param {number} intervalMs - Poll interval in milliseconds (default 500)
 * @returns {Promise<boolean>} True if printer became ready
 */
export const waitForPrinterReady = async (timeoutMs = 10000, intervalMs = 500) => {
  if (!isSunmiDevice()) {
    return false;
  }

  const startTime = Date.now();
  
  while (Date.now() - startTime < timeoutMs) {
    const ready = await isPrinterReady();
    if (ready) {
      return true;
    }
    
    // Wait before next check
    await new Promise(resolve => setTimeout(resolve, intervalMs));
  }
  
  return false;
};

/**
 * Get cached printer status from window object
 * This is injected by MainActivity on page load
 * 
 * @returns {Object|null} Cached status or null
 */
export const getCachedPrinterStatus = () => {
  if (typeof window !== 'undefined' && window.sunmiPrinterStatus) {
    return window.sunmiPrinterStatus;
  }
  return null;
};

// Export default object with all functions
export default {
  isSunmiDevice,
  printTicket,
  getPrinterStatus,
  isPrinterReady,
  getPrinterStatusText,
  testPrint,
  waitForPrinterReady,
  getCachedPrinterStatus
};
