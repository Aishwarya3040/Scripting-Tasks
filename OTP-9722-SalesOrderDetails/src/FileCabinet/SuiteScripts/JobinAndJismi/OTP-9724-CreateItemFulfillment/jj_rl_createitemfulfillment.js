/**
 * @NApiVersion 2.1
 * @NScriptType Restlet
 */

/************************************************************************************************
 *  
 * OTP-9724 : Create API for creating the Item Fulfillment
 *
*************************************************************************************************
 *
 * Author: Jobin and Jismi IT Services
 *
 * Date Created : 3-November-2025
 *
 * Description : RESTlet script to transform a Sales Order into an Item Fulfillment record with item-level customization.
 *
 * REVISION HISTORY
 *
 * @version 1.3 : 12-November-2025 : Added line-based matching and validation for missing items by JJ0416
 *
*************************************************************************************************/

define(['N/log', 'N/record'], (log, record) => {

  /**
   * Creates an Item Fulfillment record from a Sales Order.
   * @param {Object} requestBody - The request payload containing salesOrderId and item details.
   * @returns {Object} Result object with fulfillment ID or error message.
   */
  function createItemFulfillmentFromSalesOrder(requestBody) {
    try {
      if (!requestBody || !requestBody.salesOrderId) {
        return {
          RESULT: 'FAILED',
          error: 'Missing salesOrderId in request body'
        };
      }

      const salesOrderId = requestBody.salesOrderId;
      const requestedItems = Array.isArray(requestBody.items) ? requestBody.items : [];

      const itemFulfillmentRecord = record.transform({
        fromType: record.Type.SALES_ORDER,
        fromId: salesOrderId,
        toType: record.Type.ITEM_FULFILLMENT,
        isDynamic: true
      });

      const fulfillmentLineCount = itemFulfillmentRecord.getLineCount({ sublistId: 'item' });
      let hasValidLine = false;

      for (let lineIndex = 0; lineIndex < fulfillmentLineCount; lineIndex++) {
        itemFulfillmentRecord.selectLine({ sublistId: 'item', line: lineIndex });

        const matchedItem = requestedItems.find(item => item?.line === lineIndex);

        if (matchedItem) {
          itemFulfillmentRecord.setCurrentSublistValue({
            sublistId: 'item',
            fieldId: 'itemreceive',
            value: true
          });

          if (matchedItem.quantity) {
            itemFulfillmentRecord.setCurrentSublistValue({
              sublistId: 'item',
              fieldId: 'quantity',
              value: matchedItem.quantity
            });
          }

          if (matchedItem.location) {
            itemFulfillmentRecord.setCurrentSublistValue({
              sublistId: 'item',
              fieldId: 'location',
              value: matchedItem.location
            });
          }

          hasValidLine = true;
        }

        itemFulfillmentRecord.commitLine({ sublistId: 'item' });
      }

      if (!hasValidLine) {
        throw new Error('No matching line items found on the Sales Order. Please verify item references.');
      }

      const savedFulfillmentId = itemFulfillmentRecord.save();

      log.audit({
        title: 'Item Fulfillment Created',
        details: `ID: ${savedFulfillmentId}`
      });

      return {
        RESULT: 'Item Fulfillment Created',
        fulfillmentId: savedFulfillmentId
      };

    } catch (fulfillmentError) {
      log.error({
        title: 'Failed to create Item Fulfillment',
        details: fulfillmentError
      });

      return {
        RESULT: 'FAILED',
        error: fulfillmentError.message
      };
    }
  }

  /**
   * Handles POST requests to the RESTlet.
   * @param {Object|string} requestBody - The request body containing fulfillment data.
   * @returns {Object} Response object with result or error.
   */
  const handlePostRequest = requestBody => {
    try {
      return createItemFulfillmentFromSalesOrder(requestBody);
    } catch (postError) {
      log.error({
        title: 'Failed to process POST request',
        details: postError
      });

      return {
        RESULT: 'FAILED',
        error: postError.message
      };
    }
  };

  return {
    post: handlePostRequest
  };
});
