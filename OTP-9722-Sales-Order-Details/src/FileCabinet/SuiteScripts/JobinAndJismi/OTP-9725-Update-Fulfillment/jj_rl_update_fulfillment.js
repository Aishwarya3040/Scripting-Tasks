/**
 * @NApiVersion 2.1
 * @NScriptType Restlet
 */

/************************************************************************************************
 *  
 * OTP-9725 : Create API for updating the Item Fulfillment
 *
*************************************************************************************************
 *
 * Author: Jobin and Jismi IT Services
 *
 * Date Created : 3-November-2025
 *
 * Description : RESTlet script to update fields and line items on an existing Item Fulfillment record.
 *
 * REVISION HISTORY
 *
 * @version 1.0 : 11-November-2025 : Initial build created by JJ0416
 *
*************************************************************************************************/

define(['N/log', 'N/record', 'N/format'], function(log, record, format) {

  /**
   * Updates an existing Item Fulfillment record with header and line-level changes.
   * @param {Object} requestBody - The request payload containing fulfillment ID and update details.
   * @returns {Object} Result object with updated fulfillment ID or error message.
   */
  function updateItemFulfillmentRecord(requestBody) {
    try {
      if (!requestBody || !requestBody.itemFulfillmentId) {
        return {
          RESULT: "FAILED",
          error: "Missing itemFulfillmentId in request body"
        };
      }

      const fulfillmentId = requestBody.itemFulfillmentId;

      const itemFulfillmentRecord = record.load({
        type: record.Type.ITEM_FULFILLMENT,
        id: fulfillmentId,
        isDynamic: false
      });

      if (requestBody.trandate) {
        const parsedDate = format.parse({
          value: requestBody.trandate,
          type: format.Type.DATE
        });
        itemFulfillmentRecord.setValue({
          fieldId: 'trandate',
          value: parsedDate
        });
      }

      if (requestBody.postingPeriod) {
        itemFulfillmentRecord.setValue({
          fieldId: 'postingperiod',
          value: requestBody.postingPeriod
        });
      }

      if (requestBody.memo) {
        itemFulfillmentRecord.setValue({
          fieldId: 'memo',
          value: requestBody.memo
        });
      }

      const itemLineCount = itemFulfillmentRecord.getLineCount({ sublistId: 'item' });

      if (requestBody.items && Array.isArray(requestBody.items)) {
        requestBody.items.forEach((itemDetail) => {
          if (typeof itemDetail.line === 'number' && itemDetail.line < itemLineCount) {
            itemFulfillmentRecord.setSublistValue({
              sublistId: 'item',
              fieldId: 'itemreceive',
              line: itemDetail.line,
              value: true
            });

            if (itemDetail.quantity !== undefined) {
              itemFulfillmentRecord.setSublistValue({
                sublistId: 'item',
                fieldId: 'quantity',
                line: itemDetail.line,
                value: itemDetail.quantity
              });
            }
          }
        });
      }

      const updatedFulfillmentId = itemFulfillmentRecord.save();

      log.audit({
        title: 'Item Fulfillment Updated',
        details: `ID: ${updatedFulfillmentId}`
      });

      return {
        RESULT: "Item Fulfillment Updated",
        fulfillmentId: updatedFulfillmentId
      };

    } catch (error) {
      log.error({
        title: 'Failed to update Item Fulfillment',
        details: error.message
      });
      return {
        RESULT: "FAILED",
        error: error.message
      };
    }
  }

  /**
   * Handles PUT requests to the RESTlet.
   * @param {Object|string} requestBody - The request body containing update data.
   * @returns {Object} Response object with result or error.
   */
  const handlePutRequest = (requestBody) => {
    try {
      return updateItemFulfillmentRecord(requestBody);
    } catch (error) {
        log.error({
          title: 'Failed to process PUT request',
          details: error
      });
      return {
        RESULT: "FAILED",
        error: error.message
      };
    }
  };

  return {
    put: handlePutRequest
  };
});
