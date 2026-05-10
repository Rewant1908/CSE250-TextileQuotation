// backend/agents/runner/agentRegistry.js
import { inventoryTools } from '../tools/inventoryTools.js'
import { salesTools     } from '../tools/salesTools.js'
import { quotationTools } from '../tools/quotationTools.js'
import { productTools   } from '../tools/productTools.js'
import { retailerTools  } from '../tools/retailerTools.js'
import { warehouseTools } from '../tools/warehouseTools.js'

export const AGENT_TOOL_REGISTRY = {
  inventory:  inventoryTools,
  sales:      salesTools,
  quotation:  quotationTools,
  product:    productTools,
  retailer:   retailerTools,
  warehouse:  warehouseTools,
}

export const ALL_ACTION_TOOLS = [
  ...quotationTools,
  ...productTools,
  ...retailerTools,
  ...warehouseTools,
  ...inventoryTools,
  ...salesTools,
]
