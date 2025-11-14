/**
 * @NApiVersion 2.1
 * @NScriptType Restlet
 */

/************************************************************************************************
 *  
 * OTP-9726 : API for the Deleting the Item fulfillment
 *
*************************************************************************************************
 *
 * Author: Jobin and Jismi IT Services
 *
 * Date Created : 3-November-2025
 *
 * Description : RESTlet script to delete an Item Fulfillment record based on its internal ID.
 *
 * REVISION HISTORY
 *
 * @version 1.0 : 11-November-2025 : Initial build created by JJ0416
 *
*************************************************************************************************/

define(['N/log', 'N/record'], function(log, record) {

  /**
   * Deletes an Item Fulfillment record by its internal ID.
   * @param {Object} requestParams - Parameters containing itemFulfillmentId.
   * @returns {Object} Result object indicating success or failure.
   */
  function deleteItemFulfillmentRecord(requestParams) {
    try {
      const fulfillmentId = requestParams?.itemFulfillmentId;

      if (!fulfillmentId) {
        return {
          RESULT: "FAILED",
          error: "Missing itemFulfillmentId in request parameters"
        };
      }

      try {
        record.load({
          type: record.Type.ITEM_FULFILLMENT,
          id: fulfillmentId
        });
      } catch (loadError) {
        return {
          RESULT: "FAILED",
          error: "Item Fulfillment record not found"
        };
      }

      record.delete({
        type: record.Type.ITEM_FULFILLMENT,
        id: fulfillmentId
      });

      log.audit({
        title: 'Item Fulfillment Deleted',
        details: `ID: ${fulfillmentId}`
      });

      return {
        RESULT: "Item Fulfillment Deleted",
        fulfillmentId: fulfillmentId
      };

    } catch (error) {
      log.error({
        title: 'Failed to delete Item Fulfillment',
        details: error.message || error.toString()
      });

      return {
        RESULT: "FAILED",
        error: error.message || "Unknown error occurred"
      };
    }
  }

  return {
    delete: deleteItemFulfillmentRecord
  };
});
