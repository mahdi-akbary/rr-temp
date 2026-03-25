import {
  DiscountClass,
  OrderDiscountSelectionStrategy,
  ProductDiscountSelectionStrategy,
} from '../generated/api';
import { logic } from '../logics/logic';


/**
  * @typedef {import("../generated/api").CartInput} RunInput
  * @typedef {import("../generated/api").CartLinesDiscountsGenerateRunResult} CartLinesDiscountsGenerateRunResult
  */

/**
  * @param {RunInput} input
  * @returns {CartLinesDiscountsGenerateRunResult}
  */

export function cartLinesDiscountsGenerateRun(input) {
  const metafield = input.discount.metafield.jsonValue
  console.log(JSON.stringify(metafield),logic())
  
  if (!input.cart.lines.length) {
    return {operations: []};
  }
  const hasOrderDiscountClass = input.discount.discountClasses.includes(
    DiscountClass.Order,
  );
  const hasProductDiscountClass = input.discount.discountClasses.includes(
    DiscountClass.Product,
  );

  if (!hasOrderDiscountClass && !hasProductDiscountClass) {
    return {operations: []};
  }

  const maxCartLine = input.cart.lines.reduce((maxLine, line) => {
    if (line.cost.subtotalAmount.amount > maxLine.cost.subtotalAmount.amount) {
      return line;
    }
    return maxLine;
  }, input.cart.lines[0]);


  const cartB = input.cart.lines.find(line => line.merchandise.product.id  == metafield.product_a)

  const operations = [];

  // if (hasOrderDiscountClass) {
  //   operations.push({
  //     orderDiscountsAdd: {
  //       candidates: [
  //         {
  //           message: '$30 OFF ORDER',
  //           targets: [
  //             {
  //               orderSubtotal: {
  //                 excludedCartLineIds: [],
  //               },
  //             },
  //           ],
  //           value: {
  //             fixedAmount: {
  //               amount : 30
  //             },
              
  //           },
  //         },
  //       ],
  //       selectionStrategy: OrderDiscountSelectionStrategy.First,
  //     },
  //   });
  // }

  if (cartB) {
    operations.push({
      productDiscountsAdd: {
        candidates: [
          {
            message: metafield.message,
            targets: [
              {
                cartLine: {
                  id: cartB.id,
                },
              },
            ],
            value: {
              percentage: {
                value: metafield.percentage,
              },
            },
          },
        ],
        selectionStrategy: ProductDiscountSelectionStrategy.First,
      },
    });
  }

  return {
    operations,
  };
}


function myfunc ( ){
  
}
