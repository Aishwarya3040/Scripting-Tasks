/**
 * @NApiVersion 2.1
 * @NScriptType UserEventScript
 */

/************************************************************************************************
 *  
 * OTP-9777 : Restrict IF save
 *
*************************************************************************************************
 *
 * Author: Jobin and Jismi IT Services
 *
 * Date Created : 1-November-2025
 *
 * Description : Prevents item fulfillment creation if customer deposit is less than the sales order total.
 *
 * REVISION HISTORY
 *
 * @version 1.0 : 11-November-2025 : Initial build created by JJ0416
 *
*************************************************************************************************/

define(['N/record', 'N/runtime', 'N/search'], function(record, runtime, search) {

  /**
   * Validates deposit amount before allowing fulfillment creation.
   * Blocks fulfillment if deposit is less than sales order total.
   * @param {UserEventContext} scriptContext - The context object for the user event.
   */
  const beforeSubmit = (scriptContext) => {
    try {
      const executionSource = runtime.executionContext;

      if (executionSource !== runtime.ContextType.USER_INTERFACE) {
        return;
      }

      if (scriptContext.type !== scriptContext.UserEventType.CREATE) {
        return;
      }

      const fulfillmentRecord = scriptContext.newRecord;
      const originatingSalesOrderId = fulfillmentRecord.getValue({ fieldId: 'createdfrom' });

      if (!originatingSalesOrderId) {
        return;
      }

      const salesOrderRecord = record.load({
        type: record.Type.SALES_ORDER,
        id: originatingSalesOrderId,
        isDynamic: false
      });

      const salesOrderStatus = salesOrderRecord.getText({ fieldId: 'status' });
      const salesOrderTotal = parseFloat(salesOrderRecord.getValue({ fieldId: 'total' })) || 0;

      if (salesOrderStatus !== 'Pending Fulfillment') {
        return;
      }

      const totalDeposits = getTotalCustomerDeposits(originatingSalesOrderId);

      if (totalDeposits < salesOrderTotal) {
        throw new Error(
          'Deposit ₹' + totalDeposits.toFixed(2) +
          ' is less than Sales Order total ₹' + salesOrderTotal.toFixed(2) +
          '. Fulfillment blocked.'
        );
      }

    } catch (error) {
      throw error;
    }
  };

  /**
   * Calculates the total deposit amount linked to a sales order.
   * @param {number} salesOrderId - Internal ID of the sales order.
   * @returns {number} Total deposit amount.
   */
  const getTotalCustomerDeposits = (salesOrderId) => {
    try {
      const depositSearch = search.create({
        type: search.Type.CUSTOMER_DEPOSIT,
        filters: [
          ['createdfrom', 'anyof', salesOrderId],
          'AND',
          ['mainline', 'is', 'T']
        ],
        columns: ['total']
      });

      let accumulatedDeposit = 0;

      depositSearch.run().each(function(result) {
        const depositAmount = parseFloat(result.getValue('total'));
        if (!isNaN(depositAmount)) {
          accumulatedDeposit += depositAmount;
        }
        return true;
      });

      return accumulatedDeposit;

    } catch (error) {
      return 0;
    }
  };

  return {
    beforeSubmit: beforeSubmit
  };
});
