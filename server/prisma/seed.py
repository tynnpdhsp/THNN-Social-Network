import asyncio
import hashlib
import random
import json
from datetime import datetime, timezone, timedelta
from prisma import Prisma
from prisma import Json
from app.core.security import hash_password

async def seed():
    db = Prisma()
    await db.connect()

    print("--- [1/8] Cleaning database ---")
    await db.notification.delete_many()
    await db.like.delete_many()
    await db.comment.delete_many()
    await db.postimage.delete_many()
    await db.boardposttag.delete_many()
    await db.boardpostimage.delete_many()
    await db.post.delete_many()
    await db.boardtag.delete_many()
    await db.friendship.delete_many()
    await db.userblock.delete_many()
    await db.report.delete_many()
    await db.refreshtoken.delete_many()
    await db.privacysetting.delete_many()
    await db.notificationsetting.delete_many()
    await db.message.delete_many()
    await db.conversation.delete_many()
    await db.auditlog.delete_many()
    await db.review.delete_many()
    await db.order.delete_many()
    await db.shopitem.delete_many()
    await db.itemimage.delete_many()
    await db.itemcategory.delete_many()
    await db.document.delete_many()
    await db.documentcategory.delete_many()
    await db.placebookmark.delete_many()
    await db.placeimage.delete_many()
    await db.place.delete_many()
    await db.placecategory.delete_many()
    await db.scheduleentry.delete_many()
    await db.schedule.delete_many()
    await db.coursesection.delete_many()
    await db.studynote.delete_many()
    await db.user.update_many(where={}, data={"lockedBy": None})
    await db.user.delete_many()
    await db.role.delete_many()

    print("--- [2/8] Seeding Roles & Users ---")
    admin_role = await db.role.create(data={"role": "admin"})
    student_role = await db.role.create(data={"role": "student"})
    
    password_raw = "password123"
    password_hash = hash_password(password_raw)

    # Tạo 1 Admin mặc định
    admin_user = await db.user.create(data={
        "email": "admin@thnn.com",
        "phoneNumber": "0888999000",
        "passwordHash": password_hash,
        "fullName": "Quản trị viên Hệ thống",
        "roleId": admin_role.id,
        "emailVerified": True,
        "bio": "Tài khoản quản trị cấp cao."
    })
    await db.privacysetting.create(data={"userId": admin_user.id})
    await db.notificationsetting.create(data={"userId": admin_user.id})

    users = []
    # Tạo 20 người dùng cho phong phú
    for i in range(1, 21):
        u = await db.user.create(data={
            "email": f"student{i}@thnn.com",
            "phoneNumber": f"090{i:02d}123456",
            "passwordHash": password_hash,
            "fullName": f"Sinh Viên {i}",
            "roleId": student_role.id,
            "emailVerified": True,
            "bio": f"Chào tôi là sinh viên thứ {i} của trường.",
            "avatarUrl": f"https://api.dicebear.com/7.x/avataaars/svg?seed=S{i}"
        })
        users.append(u)
        await db.privacysetting.create(data={"userId": u.id})
        await db.notificationsetting.create(data={"userId": u.id})

    u_an = users[0]
    u_binh = users[1]

    print("--- [3/8] Seeding Social (Friendships, Posts, Interactions) ---")
    # Friends
    for i in range(1, 10):
        await db.friendship.create(data={"requesterId": u_an.id, "receiverId": users[i].id, "status": "accepted"})
    
    # Posts & Board Tags
    tags = []
    for t_name in ["Tìm trọ", "Tìm đồ", "Hỏi đáp", "Góc học tập", "Câu lạc bộ"]:
        tag = await db.boardtag.create(data={"name": t_name, "slug": t_name.lower().replace(" ", "-")})
        tags.append(tag)

    for i in range(15):
        p_type = "feed" if i < 10 else "board"
        p = await db.post.create(data={
            "userId": random.choice(users).id,
            "content": f"Nội dung bài viết thứ {i+1} về chủ đề {'Newsfeed' if p_type=='feed' else 'Rao vặt'}.",
            "postType": p_type,
            "boardTagId": tags[i % len(tags)].id if p_type == "board" else None
        })
        # Lượt thích ngẫu nhiên
        for j in range(random.randint(0, 5)):
            try: await db.like.create(data={"targetId": p.id, "targetType": "post", "userId": users[j].id})
            except: pass
        await db.post.update(where={"id": p.id}, data={"likeCount": 5})

    print("--- [4/8] Seeding Messaging (Conversations & Messages) ---")
    conv = await db.conversation.create(data={
        "type": "direct",
        "members": Json([{"user_id": u_an.id}, {"user_id": u_binh.id}])
    })
    for i in range(5):
        await db.message.create(data={
            "conversationId": conv.id,
            "senderId": u_an.id if i % 2 == 0 else u_binh.id,
            "content": f"Tin nhắn mẫu số {i+1}"
        })

    print("--- [5/8] Seeding Shop & Orders ---")
    cat_shop = await db.itemcategory.create(data={"name": "Giáo trình", "description": "Sách vở cũ"})
    item = await db.shopitem.create(data={
        "sellerId": u_binh.id,
        "categoryId": cat_shop.id,
        "title": "Sách Giải tích 1",
        "description": "Sách còn mới 90%, không viết bậy.",
        "price": 50000
    })
    await db.order.create(data={
        "buyerId": u_an.id,
        "itemId": item.id,
        "sellerId": u_binh.id,
        "amount": 50000,
        "status": "paid",
        "paidAt": datetime.now(timezone.utc)
    })

    print("--- [6/8] Seeding Documents & Study ---")
    doc_cat = await db.documentcategory.create(data={"name": "Tài liệu CNTT"})
    await db.document.create(data={
        "userId": u_an.id,
        "categoryId": doc_cat.id,
        "title": "Slide bài giảng Hệ điều hành",
        "fileUrl": "https://storage.com/os.pdf",
        "fileName": "os.pdf",
        "fileSize": 1024567,
        "fileType": "application/pdf"
    })

    print("--- [7/8] Seeding Places & Reviews ---")
    pl_cat = await db.placecategory.create(data={"name": "Quán ăn", "icon": "restaurant"})
    place = await db.place.create(data={
        "userId": u_an.id,
        "categoryId": pl_cat.id,
        "name": "Cơm gà Xối Mỡ A1",
        "latitude": 21.0285,
        "longitude": 105.8542,
        "address": "Cổng sau ký túc xá"
    })
    await db.review.create(data={
        "targetId": place.id,
        "targetType": "place",
        "userInfo": Json({"id": u_binh.id, "full_name": u_binh.fullName}),
        "rating": 5,
        "comment": "Cơm ngon, nhiều thịt, giá sinh viên!"
    })

    print("--- [8/8] Seeding Privacy, Blocks & Reports ---")
    # Sinh Viên 1: Chỉ nhận tin nhắn/kết bạn từ bạn bè
    await db.privacysetting.update(
        where={"userId": users[0].id},
        data={
            "whoCanMessage": "friends",
            "whoCanFriendReq": "friends_of_friends"
        }
    )

    # Chặn: Sinh Viên 1 chặn Sinh Viên 20
    await db.userblock.create(data={
        "blockerId": users[0].id,
        "blockedId": users[19].id
    })

    # Khóa: Sinh Viên 19 bị Admin khóa
    await db.user.update(
        where={"id": users[18].id},
        data={
            "isLocked": True,
            "lockReason": "Vi phạm quy tắc cộng đồng liên tục",
            "lockedBy": admin_user.id
        }
    )

    # Báo cáo:
    # 1. Báo cáo User (Sinh Viên 1 báo cáo Sinh Viên 20)
    await db.report.create(data={
        "reporterId": users[0].id,
        "targetType": "user",
        "targetId": users[19].id,
        "reason": "spam",
        "description": "Gửi tin nhắn rác liên tục dù đã nhắc nhở",
        "status": "pending"
    })
    # 2. Báo cáo Bài viết
    random_post = await db.post.find_first(where={"postType": "feed"})
    if random_post:
        await db.report.create(data={
            "reporterId": users[1].id,
            "targetType": "post",
            "targetId": random_post.id,
            "reason": "hate_speech",
            "description": "Nội dung mang tính công kích cá nhân",
            "status": "pending"
        })

    print("\n--- additional ----")

    print("\n--- SEEDING COMPLETED SUCCESSFULLY! ---")
    await db.disconnect()

if __name__ == "__main__":
    asyncio.run(seed())
