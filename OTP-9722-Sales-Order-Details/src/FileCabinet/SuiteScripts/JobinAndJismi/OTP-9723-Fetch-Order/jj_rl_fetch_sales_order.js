/**
 * @NApiVersion 2.1
 * @NScriptType Restlet
 */

/************************************************************************************************
 *  
 * OTP-9723 : Create API for the fetching the Sales order details
 *
*************************************************************************************************
 *
 * Author: Jobin and Jismi IT Services
 *
 * Date Created : 3-November-2025
 *
 * Description : RESTlet script to retrieve open Sales Orders in summary and detailed format.
 *
 * REVISION HISTORY
 *
 * @version 1.0 : 11-November-2025 : Initial build created by JJ0416
 *
*************************************************************************************************/

define(['N/log', 'N/record', 'N/search'], function(log, record, search) {

  /**
   * Retrieves a list of open Sales Orders with grouped summary data.
   * @returns {Object} An object containing an array of summarized Sales Orders or an error.
   */
  function getOpenSalesOrdersSummary() {
    try {
      log.debug('getOpenSalesOrdersSummary', 'Starting grouped search');

      const salesOrderSearch = search.create({
        type: search.Type.SALES_ORDER,
        filters: [['status', 'anyof', ['SalesOrd:A', 'SalesOrd:B', 'SalesOrd:F']]],
        columns: [
          search.createColumn({ name: 'internalid', summary: 'GROUP' }),
          search.createColumn({ name: 'tranid', summary: 'GROUP' }),
          search.createColumn({ name: 'trandate', summary: 'GROUP' }),
          search.createColumn({ name: 'total', summary: 'SUM' })
        ]
      });

      const searchResults = salesOrderSearch.run().getRange({ start: 0, end: 10 });
      log.debug('getOpenSalesOrdersSummary', `Grouped results found: ${searchResults.length}`);

      const summarizedOrders = searchResults.map((result, index) => {
        log.debug(`Grouped Result ${index}`, 'Processing row');
        return {
          internalId: String(result.getValue({ name: 'internalid', summary: 'GROUP' }) || ''),
          documentNumber: String(result.getValue({ name: 'tranid', summary: 'GROUP' }) || ''),
          date: String(result.getValue({ name: 'trandate', summary: 'GROUP' }) || ''),
          totalAmount: Number(result.getValue({ name: 'total', summary: 'SUM' }) || 0)
        };
      });

      return { result: summarizedOrders };

    } catch (error) {
        log.error('getOpenSalesOrdersSummary Error', JSON.stringify(error));
        return {
          error: {
            code: 'UNEXPECTED_ERROR',
            message: error.message || 'Unknown error',
            stack: error.stack || 'No stack trace'
        }
      };
    }
  }

  /**
   * Retrieves detailed information for a single Sales Order.
   * @param {string} salesOrderId - Internal ID of the Sales Order.
   * @returns {Object} An object containing Sales Order details or an error.
   */
  function getSalesOrderDetailsById(salesOrderId) {
    try {
      log.debug('getSalesOrderDetailsById', `Checking Sales Order ID: ${salesOrderId}`);

      const lookupResult = search.lookupFields({
        type: search.Type.SALES_ORDER,
        id: salesOrderId,
        columns: ['internalid']
      });

      if (!lookupResult || !lookupResult.internalid) {
        log.debug('getSalesOrderDetailsById', 'Sales Order not found');
        return { result: 'NOT FOUND' };
      }

      const salesOrderRecord = record.load({
        type: record.Type.SALES_ORDER,
        id: salesOrderId,
        isDynamic: false
      });

      const itemLineCount = salesOrderRecord.getLineCount({ sublistId: 'item' });
      log.debug('getSalesOrderDetailsById', `Item count: ${itemLineCount}`);

      const itemDetails = [];
      for (let i = 0; i < itemLineCount; i++) {
        itemDetails.push({
          itemName: String(salesOrderRecord.getSublistText({ sublistId: 'item', fieldId: 'item', line: i }) || ''),
          quantity: Number(salesOrderRecord.getSublistValue({ sublistId: 'item', fieldId: 'quantity', line: i }) || 0),
          rate: Number(salesOrderRecord.getSublistValue({ sublistId: 'item', fieldId: 'rate', line: i }) || 0),
          grossAmount: Number(salesOrderRecord.getSublistValue({ sublistId: 'item', fieldId: 'amount', line: i }) || 0)
        });
      }

      return {
        result: {
          internalId: String(salesOrderRecord.id),
          documentNumber: String(salesOrderRecord.getValue('tranid') || ''),
          date: String(salesOrderRecord.getValue('trandate') || ''),
          totalAmount: Number(salesOrderRecord.getValue('total') || 0),
          items: itemDetails
        }
      };

    } catch (error) {
        log.error('getSalesOrderDetailsById Error', JSON.stringify(error));
        return {
          error: {
            code: 'UNEXPECTED_ERROR',
            message: error.message || 'Unknown error',
            stack: error.stack || 'No stack trace'
        }
      };
    }
  }

  /**
   * Handles GET requests to the RESTlet.
   * If an ID is provided, returns a single Sales Order; otherwise, returns a summary list.
   * @param {Object} requestParams - Parameters passed in the GET request.
   * @returns {Object} Sales Order data or error object.
   */
  const handleGetRequest = (requestParams) => {
    try {
      log.debug('handleGetRequest', JSON.stringify(requestParams));

      if (requestParams && requestParams.id) {
        return getSalesOrderDetailsById(requestParams.id);
      } else {
          return getOpenSalesOrdersSummary();
      }

    } catch (error) {
        log.error('handleGetRequest Error', JSON.stringify(error));
        return {
          error: {
            code: 'UNEXPECTED_ERROR',
            message: error.message || 'Unknown error',
            stack: error.stack || 'No stack trace'
        }
      };
    }
  };

  return {
    get: handleGetRequest
  };
});
