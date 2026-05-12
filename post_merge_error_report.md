# Báo cáo Tổng hợp Lỗi Codebase (Sau khi Merge Conflict)

Báo cáo này tổng hợp các lỗi và rủi ro tiềm tàng trong codebase sau quá trình resolve conflict nhanh để merge vào nhánh `main`.

---

## 1. Dấu hiệu Conflict (Git Merge Markers)

**Kết quả**: An toàn. Không tìm thấy các marker conflict chưa được resolve (như `<<<<<<< HEAD`, `=======`, `>>>>>>>`) sót lại trong thư mục mã nguồn (`client/src/` và `server/app/`).

---

## 2. FRONTEND (`client/`)

### 2.1. Tổng quan ESLint

- **Trạng thái**: Thất bại (Exit code: 1).
- **Tổng cộng**: **97 vấn đề (93 errors, 4 warnings)**.

---

### 2.2. Lỗi Cú pháp / Parsing Error (UI Crashed)

Các lỗi này làm ứng dụng không thể render được. Đây là **ưu tiên sửa cao nhất**.

| #   | File                       | Dòng | Mô tả lỗi                                                                                   | Loại             |
| --- | -------------------------- | ---- | ------------------------------------------------------------------------------------------- | ---------------- |
| 1   | `App.jsx`                  | -    | `Unexpected token return` - Lỗi cấu trúc ngoặc `{}` sau merge                               | Parsing Error    |
| 2   | `Common/Modal.jsx`         | -    | `'import' and 'export' may only appear at the top level` - Import bị kẹt bên trong function | Parsing Error    |
| 3   | `Map/Map.jsx`              | -    | `Identifier 'React' has already been declared` - Import React nhiều lần do merge chồng chéo | Duplicate Import |
| 4   | `Map/AddLocationModal.jsx` | -    | `'import' and 'export' may only appear at the top level`                                    | Parsing Error    |
| 5   | `Shop/Shop.jsx`            | -    | `Identifier 'React' has already been declared` - Import React trùng lặp                     | Duplicate Import |
| 6   | `Shop/AddProductModal.jsx` | -    | `Identifier 'Camera' has already been declared`                                             | Duplicate Import |
| 7   | `Timetable/Timetable.jsx`  | 413  | Sử dụng các biến chưa khai báo: `plan`, `Sparkles`, `i` - Đoạn code cũ chưa được xóa sạch   | no-undef         |
| 8   | `Timetable/Timetable.jsx`  | 436  | Duplicate key `position` trong object style                                                 | no-dupe-keys     |

---

### 2.3. Lỗi React Hooks và Component Pattern

| #   | File                                                            | Mô tả lỗi                                                                                                                                                                                              | Mức độ     |
| --- | --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------- |
| 1   | `AuthPage.jsx` (Dòng 257-294)                                   | Khai báo component con (`PasswordToggle`, `SubmitBtn`, `OtpInputGrid`) **bên trong** render function. Việc này làm React tạo lại component mới mỗi lần re-render, gây mất state và hiệu ứng "nhảy" UI. | Cao        |
| 2   | `AuthContext.jsx` (Dòng 37)                                     | `Calling setState synchronously within an effect can trigger cascading renders` - Gọi `setLoading(false)` đồng bộ trong effect                                                                         | Trung bình |
| 3   | `AuthContext.jsx` (Dòng 141)                                    | `Fast refresh only works when a file only exports components` - File export cả component lẫn function (`useAuth`)                                                                                      | Thấp       |
| 4   | Nhiều file trong `Social/`                                      | Cấu trúc `useEffect(() => { load(); }, [load])` với `load = useCallback(...)` gây cảnh báo cascading renders khi `useCallback` không ổn định                                                           | Trung bình |
| 5   | `ProductDetailModal.jsx`, `DocDetailModal.jsx`, `StudyDocs.jsx` | Gọi hàm async trước khi khai báo - Phụ thuộc vào hoisting của `const` function expression                                                                                                              | Thấp       |

---

### 2.4. Lỗi Bảo mật: Dummy Token

Nhiều service đang sử dụng Token giả mạo (`dummy-token`) thay vì lấy token từ `AuthContext` hoặc `apiFetch()` (đã có sẵn tại `config/api.js`).

| #   | File                          | Số lần sử dụng | Pattern                                          |
| --- | ----------------------------- | -------------- | ------------------------------------------------ | --- | -------------- |
| 1   | `services/documentService.js` | 4 lần          | Hardcode `'Authorization': 'Bearer dummy-token'` |
| 2   | `services/scheduleService.js` | 2 lần          | Hardcode `'Authorization': 'Bearer dummy-token'` |
| 3   | `services/shopService.js`     | 12 lần         | Fallback `localStorage.getItem('token')          |     | 'dummy-token'` |
| 4   | `services/placeService.js`    | 6 lần          | Fallback `localStorage.getItem('token')          |     | 'dummy-token'` |

**Đề xuất**: Các service này nên được refactor để sử dụng hàm `apiFetch()` từ `config/api.js` - hàm này đã có sẵn và tự động đính kèm token từ `localStorage`, đồng thời xử lý 401 Unauthorized (reload page khi token hết hạn).

---

### 2.5. Lỗi khác (no-unused-vars)

Nhiều file có các biến/import được khai báo nhưng không sử dụng. Đây là lỗi nhẹ, có thể tự động sửa bằng `npx eslint . --fix`.

| File              | Ví dụ                                        |
| ----------------- | -------------------------------------------- |
| `Timetable.jsx`   | `React` is defined but never used            |
| `Social/Feed.jsx` | Một số import chưa được sử dụng              |
| Nhiều file khác   | Các biến `e` trong catch block không sử dụng |

---

## 3. BACKEND (`server/`)

### 3.1. Tổng quan

- **Kết quả kiểm tra cú pháp Python**: An toàn. Không phát hiện lỗi `SyntaxError` hoặc `IndentationError`.

---

### 3.2. Lỗi Logging: Sử dụng `print()` thay vì `logger`

Có tổng cộng **8 vị trí** (không tính các dòng đã bị comment out) sử dụng `print()` để ghi log thay vì dùng module `logging` chuẩn. Trên môi trường production, các dòng `print()` này sẽ **không được ghi vào file log** và có thể mất.

| #   | File                      | Dòng | Nội dung `print()`                                             |
| --- | ------------------------- | ---- | -------------------------------------------------------------- |
| 1   | `shop/router.py`          | 307  | `print("=== VNPay IPN Callback endpoint accessed ===")`        |
| 2   | `shop/router.py"          | 309  | `print(f"Query parameters received: {params}")`                |
| 3   | `place/service.py`        | 326  | `print(f"Error in get_nearby_places: {str(e)}")`               |
| 4   | `messaging/ws_manager.py` | 59   | `print(f"DEBUG: Redis Pub/Sub error: {e}. Retrying in 5s...")` |
| 5   | `documents/service.py`    | 143  | `print(f"Failed to delete file {document.fileUrl}: {e}")`      |
| 6   | `admin/repository.py`     | 187  | `print(f"FAILED TO WRITE AUDIT LOG: {e}")`                     |
| 7   | `account/repository.py`   | 38   | `print(f"REPO_DEBUG: Searching for '{clean_query}'")`          |
| 8   | `account/repository.py`   | 65   | `print(f"REPO_DEBUG: Found {len(users)} users in DB")`         |

**Đề xuất**: Thay tất cả bằng `logger.error(...)`, `logger.warning(...)`, hoặc `logger.debug(...)` tương ứng.

---

### 3.3. Lỗi HTTP Status Code sai (NotFoundException thay vì ForbiddenException)

Khi user không có quyền truy cập tài nguyên (ví dụ: không phải owner), hệ thống nên trả về HTTP 403 (Forbidden). Tuy nhiên, hiện tại đang trả về HTTP 404 (Not Found) với message "access denied". Điều này khiến Frontend khó phân biệt được "không tìm thấy" và "không có quyền".

| #   | File                   | Dòng | Nội dung sai                                                                      |
| --- | ---------------------- | ---- | --------------------------------------------------------------------------------- |
| 1   | `documents/service.py` | 131  | `raise NotFoundException("Document not found or access denied", "ACCESS_DENIED")` |
| 2   | `documents/service.py` | 166  | `raise NotFoundException("Document not found or access denied", "ACCESS_DENIED")` |
| 3   | `shop/service.py`      | 160  | `raise NotFoundException("Item not found or access denied", "ACCESS_DENIED")`     |
| 4   | `shop/service.py`      | 192  | `raise NotFoundException("Item not found or access denied", "ACCESS_DENIED")`     |

**Đề xuất**: Đổi thành `raise ForbiddenException("Access denied", "ACCESS_DENIED")` - class `ForbiddenException` đã được import sẵn trong cả 2 file.

---

### 3.4. Bare `except:` clause (nuốt lỗi im lặng)

Sử dụng `except:` (không chỉ định exception type) là anti-pattern vì nó bắt cả các lỗi không mong đợi (bao gồm `KeyboardInterrupt`, `SystemExit`) và nuốt chúng im lặng.

| #   | File                   | Dòng | Context                                          |
| --- | ---------------------- | ---- | ------------------------------------------------ |
| 1   | `documents/service.py` | 78   | `except: pass` - Trong block rollback xóa file   |
| 2   | `admin/repository.py`  | 120  | `except: pass` - Trong block query report target |

**Đề xuất**: Đổi thành `except Exception:` để không vô tình bắt system-level exceptions.

---

### 3.5. Logic chưa hoàn thiện (TODO)

| #   | File                  | Dòng | Nội dung                                                                                                                                 |
| --- | --------------------- | ---- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `place/repository.py` | 77   | `# TODO: Implement place filtering logic` - Logic lọc địa điểm chưa được hoàn thiện, hiện tại chỉ pass dict filters trực tiếp vào Prisma |

---

### 3.6. Inline Import (Circular Dependency Workaround)

Một số file import module **bên trong hàm** thay vì ở đầu file. Điều này thường là workaround cho circular dependency và cần được refactor.

| #   | File                   | Dòng    | Import                                                                               |
| --- | ---------------------- | ------- | ------------------------------------------------------------------------------------ |
| 1   | `shop/service.py`      | 116     | `from app.utils.storage import upload_files` (trong hàm `upload_item_images`)        |
| 2   | `documents/service.py` | 76, 139 | `from app.utils.storage import ...` (trong hàm `create_document`, `delete_document`) |
| 3   | `place/repository.py`  | 342     | `import math` (trong hàm `get_nearby_places`)                                        |

---

## 4. Tổng kết và Thứ tự Ưu tiên Khắc phục

### Ưu tiên 1 - CRITICAL (UI Crashed)

1. Sửa các Parsing Error trong `App.jsx`, `Modal.jsx`, `Map.jsx`, `AddLocationModal.jsx`, `Shop.jsx`, `AddProductModal.jsx` - xóa code trùng lặp từ merge.
2. Sửa dòng 413 trong `Timetable.jsx` - xóa đoạn code cũ tham chiếu biến `plan`, `Sparkles`, `i`.

### Ưu tiên 2 - HIGH (Security)

3. Thay thế toàn bộ `dummy-token` trong 4 file service bằng `apiFetch()` từ `config/api.js`.
4. Sửa 4 vị trí `NotFoundException` thành `ForbiddenException` trong `documents/service.py` và `shop/service.py`.

### Ưu tiên 3 - MEDIUM (Code Quality)

5. Chuyển các component con (`PasswordToggle`, `SubmitBtn`, `OtpInputGrid`) ra ngoài `AuthPage` component.
6. Thay 8 vị trí `print()` bằng `logger` trong backend.
7. Sửa 2 vị trí `except:` thành `except Exception:`.

### Ưu tiên 4 - LOW (Tech Debt)

8. Hoàn thiện TODO logic lọc địa điểm trong `place/repository.py`.
9. Refactor inline imports để giải quyết circular dependency.
10. Chạy `npx eslint . --fix` để dọn dẹp các biến không sử dụng.

---

_File này được tạo tự động để giúp bạn review tổng quan tình trạng codebase của nhánh main hiện tại._
_Tổng số: 97 lỗi frontend (ESLint) + 8 print debug + 4 wrong exception + 2 bare except + 1 TODO = ~112 vấn đề cần xử lý._
