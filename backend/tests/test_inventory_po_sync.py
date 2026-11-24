import os
os.environ.setdefault("MONGO_URL", "mongodb://localhost:27017")
os.environ.setdefault("SECRET_KEY", "test-secret-key-123")

import asyncio
import pytest
from unittest.mock import AsyncMock, MagicMock
from server import (
    find_inventory_item_for_line_item,
    deduct_inventory_for_po,
    restore_inventory_for_po
)

@pytest.mark.asyncio
async def test_deduct_and_restore_inventory():
    mock_db = MagicMock()
    mock_db.inventory = MagicMock()
    
    # Fake inventory item
    fake_item = {
        "id": "inv-123",
        "product_id": "prod-1",
        "product_name": "Robotics Starter Kit",
        "sku": "ROBO-001",
        "quantity": 50,
        "unit_price": 500.0,
        "total_value": 25000.0
    }
    
    mock_db.inventory.find_one = AsyncMock(return_value=fake_item)
    mock_db.inventory.update_one = AsyncMock()

    # Create a PO with 10 units
    po_doc = {
        "po_number": "PO-999",
        "line_items": [
            {
                "product_id": "prod-1",
                "product_name": "Robotics Starter Kit",
                "sku": "ROBO-001",
                "quantity": 10,
                "unit_price": 500.0
            }
        ]
    }

    # 1. Test deduction
    adjustments = await deduct_inventory_for_po(po_doc, mock_db)
    assert len(adjustments) == 1
    assert adjustments[0]["quantity_deducted"] == 10
    assert adjustments[0]["previous_quantity"] == 50
    assert adjustments[0]["new_quantity"] == 40

    # Verify update_one was called with quantity 40 and total_value 20000.0
    mock_db.inventory.update_one.assert_called_once()
    call_args = mock_db.inventory.update_one.call_args[0]
    assert call_args[0] == {"id": "inv-123"}
    assert call_args[1]["$set"]["quantity"] == 40
    assert call_args[1]["$set"]["total_value"] == 20000.0

    # Attach adjustments and flag to PO
    po_doc["inventory_deducted"] = True
    po_doc["inventory_adjustments"] = adjustments

    # 2. Test restoration
    # After deduction, current inventory in DB is 40
    fake_item["quantity"] = 40
    mock_db.inventory.find_one = AsyncMock(return_value=fake_item)
    mock_db.inventory.update_one.reset_mock()

    restorations = await restore_inventory_for_po(po_doc, mock_db)
    assert len(restorations) == 1
    assert restorations[0]["quantity_restored"] == 10
    assert restorations[0]["previous_quantity"] == 40
    assert restorations[0]["new_quantity"] == 50

    mock_db.inventory.update_one.assert_called_once()
    restore_args = mock_db.inventory.update_one.call_args[0]
    assert restore_args[0] == {"id": "inv-123"}
    assert restore_args[1]["$set"]["quantity"] == 50
    assert restore_args[1]["$set"]["total_value"] == 25000.0
    print("Test passed successfully!")

if __name__ == "__main__":
    asyncio.run(test_deduct_and_restore_inventory())
