import asyncio
import hashlib
import random
from datetime import datetime, timezone, timedelta
from prisma import Prisma
from prisma import Json

async def seed():
    db = Prisma()
    await db.connect()

    print("--- Đang làm sạch cơ sở dữ liệu ---")
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
    await db.user.delete_many()
    await db.role.delete_many()

    print("--- Seeding Roles ---")
    admin_role = await db.role.create(data={"role": "admin"})
    student_role = await db.role.create(data={"role": "student"})

    print("--- Seeding Users ---")
    password_hash = "$2b$12$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36WQoeG6L6s5WrTHotdJSBe" # 'password123'
    
    users = []
    names = [
        "Nguyễn Văn An", "Trần Thị Bình", "Lê Văn Cường", "Phạm Thị Dung", 
        "Hoàng Văn Em", "Vũ Thị Hoa", "Đặng Văn Hùng", "Bùi Thị Lan",
        "Lý Văn Minh", "Ngô Thị Nam"
    ]
    bios = [
        "Sinh viên CNTT yêu lập trình", "Thích hát và đi du lịch", "KTS tương lai",
        "Kế toán viên chăm chỉ", "Yêu bóng đá", "Design là đam mê",
        "Học marketing", "Thích đọc sách", "Gaming is life", "Ngon lành cành đào"
    ]

    for i, name in enumerate(names):
        user = await db.user.create(data={
            "email": f"student{i+1}@thnn.com",
            "phoneNumber": f"090{i+1}555555",
            "passwordHash": password_hash,
            "fullName": name,
            "roleId": student_role.id,
            "emailVerified": True,
            "bio": bios[i],
            "avatarUrl": f"https://api.dicebear.com/7.x/avataaars/svg?seed={name.replace(' ', '')}"
        })
        users.append(user)
        # Create settings for each user
        await db.privacysetting.create(data={"userId": user.id})
        await db.notificationsetting.create(data={"userId": user.id})

    # Central User (An)
    u_an = users[0]
    u_binh = users[1]
    u_cuong = users[2]
    u_dung = users[3]

    print("--- Seeding Friendships & Blocks ---")
    # An & Binh are friends
    await db.friendship.create(data={"requesterId": u_an.id, "receiverId": u_binh.id, "status": "accepted"})
    # An & Cuong are friends
    await db.friendship.create(data={"requesterId": u_an.id, "receiverId": u_cuong.id, "status": "accepted"})
    # Dung sent request to An (pending)
    await db.friendship.create(data={"requesterId": u_dung.id, "receiverId": u_an.id, "status": "pending"})
    # An blocked Minh (u9)
    await db.userblock.create(data={"blockerId": u_an.id, "blockedId": users[8].id})

    print("--- Seeding Board Tags ---")
    tags_data = [
        {"name": "Tìm trọ", "slug": "tim-tro"},
        {"name": "Tìm ở ghép", "slug": "tim-o-ghep"},
        {"name": "Mất đồ", "slug": "mat-do"},
        {"name": "Nhặt được đồ", "slug": "nhat-duoc-do"},
        {"name": "Hỏi đáp", "slug": "hoi-dap"},
        {"name": "Góc học tập", "slug": "hoc-tap"},
    ]
    tags = []
    for t in tags_data:
        tag = await db.boardtag.create(data=t)
        tags.append(tag)

    print("--- Seeding Posts & Images ---")
    # Public post with image
    p1 = await db.post.create(data={
        "userId": u_an.id,
        "content": "Hôm nay mình vừa code xong module Newsfeed cực xịn!",
        "visibility": "public",
        "postType": "feed",
    })
    await db.postimage.create(data={
        "postId": p1.id,
        "imageUrl": "https://picsum.photos/800/600?random=1",
        "displayOrder": 0
    })

    # Board post: Tìm trọ
    b1 = await db.post.create(data={
        "userId": u_binh.id,
        "content": "Cần tìm phòng trọ khu vực Bách Khoa, ngân sách 3 triệu.",
        "visibility": "public",
        "postType": "board",
        "boardTagId": tags[0].id,
    })

    # Board post: Mất đồ
    b2 = await db.post.create(data={
        "userId": u_cuong.id,
        "content": "Mình có đánh rơi ví tiền màu đen ở nhà xe A1. Ai thấy liên hệ mình nhé!",
        "visibility": "public",
        "postType": "board",
        "boardTagId": tags[2].id,
    })

    print("--- Seeding Comments & Interactions ---")
    # Binh comments on An's post
    c1 = await db.comment.create(data={
        "targetId": p1.id, "targetType": "post",
        "userInfo": Json({"id": u_binh.id, "full_name": u_binh.fullName, "avatar_url": u_binh.avatarUrl}),
        "content": "Xịn quá ông giáo ơi!",
        "replies": Json([])
    })
    # An replies to Binh
    replies = [
        {
            "user_info": {"id": u_an.id, "full_name": u_an.fullName, "avatar_url": u_an.avatarUrl},
            "content": "Cảm ơn bà nhé!",
            "is_hidden": False,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
    ]
    await db.comment.update(where={"id": c1.id}, data={"replies": Json(replies)})
    await db.post.update(where={"id": p1.id}, data={"commentCount": 1})

    # Random likes
    for u in users[1:6]:
        await db.like.create(data={"targetId": p1.id, "targetType": "post", "userId": u.id})
    await db.post.update(where={"id": p1.id}, data={"likeCount": 5})

    print("--- Seeding Reports ---")
    # Dung reports a suspicious post (stranger post)
    await db.report.create(data={
        "reporterId": u_dung.id,
        "targetType": "post",
        "targetId": b1.id,
        "reason": "Spam",
        "description": "Bài viết có dấu hiệu lừa đảo cọc phòng trọ."
    })

    print("--- Seeding Notifications ---")
    # Notify An that Binh liked
    await db.notification.create(data={
        "userId": u_an.id, "type": "like", "title": "Lượt thích mới",
        "content": f"{u_binh.fullName} đã thích bài viết của bạn.",
        "metadata": Json({"reference_id": p1.id, "reference_type": "post"})
    })
    # Notify An about Dung's friend request
    await db.notification.create(data={
        "userId": u_an.id, "type": "friend_request", "title": "Lời mời kết bạn",
        "content": f"{u_dung.fullName} đã gửi lời mời kết bạn.",
        "metadata": Json({"reference_id": u_dung.id, "reference_type": "user"})
    })

    print("CƠ SỞ DỮ LIỆU ĐÃ ĐƯỢC SEED ĐẦY ĐỦ!")
    await db.disconnect()

if __name__ == "__main__":
    asyncio.run(seed())
