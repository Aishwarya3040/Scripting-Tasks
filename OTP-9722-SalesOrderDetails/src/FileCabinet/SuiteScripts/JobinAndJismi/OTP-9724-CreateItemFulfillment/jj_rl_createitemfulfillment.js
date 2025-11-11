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
 * @version 1.0 : 11-November-2025 : Initial build created by JJ0416
 *
*************************************************************************************************/

define(['N/log', 'N/record'], function(log, record) {

  /**
   * Creates an Item Fulfillment record from a Sales Order.
   * @param {Object} requestBody - The request payload containing salesOrderId and item details.
   * @returns {Object} Result object with fulfillment ID or error message.
   */
  function createItemFulfillmentFromSalesOrder(requestBody) {
    try {
      if (!requestBody || !requestBody.salesOrderId) {
        return {
          RESULT: "FAILED",
          error: "Missing salesOrderId in request body"
        };
      }

      const salesOrderId = requestBody.salesOrderId;
      const requestedItems = requestBody.items || [];

      const salesOrderRecord = record.load({
        type: record.Type.SALES_ORDER,
        id: salesOrderId,
        isDynamic: true
      });

      const itemFulfillmentRecord = record.transform({
        fromType: record.Type.SALES_ORDER,
        fromId: salesOrderId,
        toType: record.Type.ITEM_FULFILLMENT,
        isDynamic: true
      });

      const fulfillmentLineCount = itemFulfillmentRecord.getLineCount({ sublistId: 'item' });

      for (let i = 0; i < fulfillmentLineCount; i++) {
        itemFulfillmentRecord.selectLine({ sublistId: 'item', line: i });

        const currentItemId = itemFulfillmentRecord.getCurrentSublistValue({
          sublistId: 'item',
          fieldId: 'item'
        });

        const matchedItem = requestedItems.find(item => item.itemId == currentItemId);

        if (matchedItem && matchedItem.quantity) {
          itemFulfillmentRecord.setCurrentSublistValue({
            sublistId: 'item',
            fieldId: 'quantity',
            value: matchedItem.quantity
          });
        }

        if (matchedItem && matchedItem.location) {
          itemFulfillmentRecord.setCurrentSublistValue({
            sublistId: 'item',
            fieldId: 'location',
            value: matchedItem.location
          });
        }

        itemFulfillmentRecord.commitLine({ sublistId: 'item' });
      }

      const savedFulfillmentId = itemFulfillmentRecord.save();

      log.audit({
        title: 'Item Fulfillment Created',
        details: `ID: ${savedFulfillmentId}`
      });

      return {
        RESULT: "Item Fulfillment Created",
        fulfillmentId: savedFulfillmentId
      };

    } catch (error) {
      log.error({
        title: 'Failed to create Item Fulfillment',
        details: error
      });

      return {
        RESULT: "FAILED",
        error: error.message
      };
    }
  }

  /**
   * Handles POST requests to the RESTlet.
   * @param {Object|string} requestBody - The request body containing fulfillment data.
   * @returns {Object} Response object with result or error.
   */
  const handlePostRequest = (requestBody) => {
    try {
      return createItemFulfillmentFromSalesOrder(requestBody);
    } catch (error) {
      log.error({
        title: 'Failed to process POST request',
        details: error
      });

      return {
        RESULT: "FAILED",
        error: error.message
      };
    }
  };

  return {
    post: handlePostRequest
  };
});
