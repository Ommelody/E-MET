# THAMC e-Material — Database Schema (สรุปจากโค้ดเดิม `server.ts`)

> สรุปโครงสร้างจากการเรียกใช้ใน `server.ts` (`sbSelect/sbInsert/sbUpdate` + storage)
> ใช้ SQL ในไฟล์ `supabase-verify.sql` เพื่อยืนยัน/เทียบกับฐานข้อมูลจริงของคุณ

## ตาราง (Tables)

### `users`
| คอลัมน์ | ชนิด | หมายเหตุ |
|--------|------|---------|
| username | text (PK) | ชื่อผู้ใช้ |
| password | text | เดิมเก็บเป็น `"hashed_" + <plaintext>` |
| name | text | ชื่อ-นามสกุล |
| department | text | แผนก |
| role | text | `Admin` \| `Manager` \| `Staff` \| `User` |
| created_at | timestamptz | |
| updated_at | timestamptz | |

### `departments`
| คอลัมน์ | ชนิด | หมายเหตุ |
|--------|------|---------|
| id | int4 (PK, serial) | |
| name | text (unique) | ค่าที่ users.department อ้างถึง |

### `inventory`
| คอลัมน์ | ชนิด | หมายเหตุ |
|--------|------|---------|
| id | int8 (PK, identity) | |
| code | text (unique) | รหัสวัสดุ |
| name | text | |
| category | text | |
| unit | text | หน่วยนับ |
| quantity | int | คงเหลือ |
| min_quantity | int | จุดสั่งซื้อขั้นต่ำ |
| unit_price | numeric | ราคา/หน่วย |
| location | text | ที่ตั้ง |
| created_at | timestamptz | |
| updated_at | timestamptz | |

### `catalog` (รูปภาพวัสดุ, 1:1 กับ inventory)
| คอลัมน์ | ชนิด | หมายเหตุ |
|--------|------|---------|
| item_id | int8 (PK, FK→inventory.id) | |
| image_path | text | path ใน storage bucket `catalog-images` |
| updated_at | timestamptz | (ไม่มี created_at) |

### `requisitions` (ใบเบิก)
| คอลัมน์ | ชนิด | หมายเหตุ |
|--------|------|---------|
| id | text (PK) | รูปแบบ `REQ-YYNNNN` |
| date | date | วันที่เบิก |
| purpose | text | วัตถุประสงค์ |
| requested_by | text (FK→users.username) | |
| requestor_name | text | |
| requestor_department | text | |
| status | text | ดู "สถานะ" ด้านล่าง |
| requisition_pdf_path | text | path ใน bucket `pdfs` |
| goods_issue_pdf_links | jsonb / text | array ของ `{id,path,type,date,issuedBy}` |
| manager_approver_username | text | |
| manager_approver_name | text | |
| manager_approval_status | text | |
| manager_approval_date | timestamptz | |
| manager_approval_note | text | |
| stock_approver_username | text | |
| stock_approver_name | text | |
| stock_approval_status | text | |
| stock_approval_date | timestamptz | |
| stock_approval_note | text | |
| created_at | timestamptz | |
| updated_at | timestamptz | |

### `requisition_items` (รายการในใบเบิก)
| คอลัมน์ | ชนิด | หมายเหตุ |
|--------|------|---------|
| id | int4 (PK, serial) | |
| requisition_id | text (FK→requisitions.id) | |
| item_id | int8 (FK→inventory.id) | |
| item_name | text | |
| quantity | int | จำนวนขอเบิก |
| unit | text | |
| dispensed_quantity | int | จ่ายจริงสะสม |
| unit_price | numeric | |
| is_backordered | bool | ค้างจ่าย |
| notes_for_item | text | |
| total_price | numeric | **generated STORED column** = `dispensed_quantity × unit_price` — **ห้ามเขียนค่าเอง** (DB คำนวณให้); เป็น 0 จนกว่าจะจ่ายของ |

### `transaction_logs` (บันทึกความเคลื่อนไหวสต๊อก)
| คอลัมน์ | ชนิด | หมายเหตุ |
|--------|------|---------|
| transaction_id | text (PK) | `TRN/GRN/GI...-YYMMDDNNNN` |
| timestamp | timestamptz | |
| type | text | `Goods Receipt` \| `Requisition Issue` |
| reference_no | text | |
| item_id | int8 | |
| item_code | text | |
| item_name | text | |
| quantity_change | int | +รับเข้า / −จ่ายออก |
| unit | text | |
| unit_price | numeric | |
| value_change | numeric | |
| new_stock_quantity | int | |
| received_by | text | |
| notes | text | |
| source | text | |

### `id_counters` (ตัวนับเลขที่เอกสาร)
| คอลัมน์ | ชนิด |
|--------|------|
| prefix | text |
| year | text (2 หลัก) |
| last_counter | int |

*(PK แบบ composite: `prefix` + `year`)*

## Storage buckets
| bucket | public | ใช้เก็บ |
|--------|--------|--------|
| `catalog-images` | **true** (public) | รูปวัสดุ (`catalog/<id>.<ext>`) — อ่าน public ได้ตรง |
| `pdfs` | **false** (private) | เอกสาร HTML ใบเบิก/ใบจ่าย — ต้องเข้าถึงผ่าน **signed URL** (ผ่าน backend) |

## สถานะใบเบิก (requisition status)
`Pending Manager Approval` → `Pending Stock Approval` → (`Partially Completed` →) `Completed`
สาขาปฏิเสธ: `Rejected by Manager`, `Rejected by Stock`

## Flow การอนุมัติ
1. ผู้ใช้สร้างใบเบิก → `Pending Manager Approval`
2. Manager อนุมัติ → `Pending Stock Approval` (หรือ `Rejected by Manager`)
3. เจ้าหน้าที่พัสดุจ่ายของ → `Completed` / `Partially Completed` (ถ้าของไม่พอ = ค้างจ่าย) / `Rejected by Stock`
4. เติมของค้างจ่าย (fulfill backorder) → `Completed` เมื่อจ่ายครบ

> ✅ ยืนยันกับฐานข้อมูลจริงแล้ว (2568): `total_price` เป็น **generated STORED** = `dispensed_quantity × unit_price` (ห้ามเขียนเอง), `goods_issue_pdf_links` เป็น `jsonb` default `[]`, `users` PK = `username`, bucket `pdfs` เป็น private (ใช้ signed URL)
