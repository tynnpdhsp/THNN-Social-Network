import asyncio
import hashlib
from datetime import datetime, timezone, timedelta
from prisma import Prisma
from prisma.models import User, Role, BoardTag, Post, Comment, Like, Friendship, PrivacySetting, NotificationSetting

async def seed():
    db = Prisma()
    await db.connect()

    print("Cleaning database...")
    # Delete in order of dependencies to avoid constraint issues (though MongoDB is lenient)
    await db.notification.delete_many()
    await db.like.delete_many()
    await db.comment.delete_many()
    await db.postimage.delete_many()
    await db.boardposttag.delete_many()
    await db.boardpostimage.delete_many()
    await db.post.delete_many()
    await db.boardtag.delete_many()
    await db.friendship.delete_many()
    await db.refreshtoken.delete_many()
    await db.privacysetting.delete_many()
    await db.notificationsetting.delete_many()
    await db.user.delete_many()
    await db.role.delete_many()

    print("Seeding roles...")
    admin_role = await db.role.create(data={"role": "admin"})
    student_role = await db.role.create(data={"role": "student"})

    print("Seeding users...")
    password_hash = "$2b$12$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36WQoeG6L6s5WrTHotdJSBe" # 'password123'
    
    admin = await db.user.create(data={
        "email": "admin@thnn.com",
        "phoneNumber": "0123456789",
        "passwordHash": password_hash,
        "fullName": "System Admin",
        "roleId": admin_role.id,
        "emailVerified": True,
    })

    # Student 1: The central user
    u1 = await db.user.create(data={
        "email": "student1@thnn.com",
        "phoneNumber": "0901111111",
        "passwordHash": password_hash,
        "fullName": "Nguyen Van A",
        "roleId": student_role.id,
        "emailVerified": True,
        "bio": "Sinh vien nam 3 khoa CNTT",
        "avatarUrl": "https://api.dicebear.com/7.x/avataaars/svg?seed=A"
    })

    # Student 2: Friend of Student 1
    u2 = await db.user.create(data={
        "email": "student2@thnn.com",
        "phoneNumber": "0902222222",
        "passwordHash": password_hash,
        "fullName": "Tran Thi B",
        "roleId": student_role.id,
        "emailVerified": True,
        "bio": "Yeu thich am nhac va lap trinh",
        "avatarUrl": "https://api.dicebear.com/7.x/avataaars/svg?seed=B"
    })

    # Student 3: Pending friend request from Student 1
    u3 = await db.user.create(data={
        "email": "student3@thnn.com",
        "phoneNumber": "0903333333",
        "passwordHash": password_hash,
        "fullName": "Le Van C",
        "roleId": student_role.id,
        "emailVerified": True,
        "bio": "Kien truc su tuong lai",
        "avatarUrl": "https://api.dicebear.com/7.x/avataaars/svg?seed=C"
    })

    # Student 4: Stranger
    u4 = await db.user.create(data={
        "email": "student4@thnn.com",
        "phoneNumber": "0904444444",
        "passwordHash": password_hash,
        "fullName": "Pham Thi D",
        "roleId": student_role.id,
        "emailVerified": True,
        "bio": "Nguoi la oi",
        "avatarUrl": "https://api.dicebear.com/7.x/avataaars/svg?seed=D"
    })

    print("Seeding friendships...")
    # S1 & S2 are friends
    await db.friendship.create(data={
        "requesterId": u1.id,
        "receiverId": u2.id,
        "status": "accepted"
    })

    # S1 sent request to S3 (pending)
    await db.friendship.create(data={
        "requesterId": u1.id,
        "receiverId": u3.id,
        "status": "pending"
    })

    print("Seeding board tags...")
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

    print("Seeding posts...")
    # --- Feed Posts (student1) ---
    # Public
    p1_pub = await db.post.create(data={
        "userId": u1.id,
        "content": "[Public] Chao moi nguoi! Day la bai viet cong khai.",
        "visibility": "public",
        "postType": "feed",
    })
    
    # Friends only
    p1_fri = await db.post.create(data={
        "userId": u1.id,
        "content": "[Friends] Chi ban be moi thay duoc bai nay nhe!",
        "visibility": "friends",
        "postType": "feed",
    })

    # Private
    p1_pri = await db.post.create(data={
        "userId": u1.id,
        "content": "[Private] Chi minh toi thay thoi.",
        "visibility": "private",
        "postType": "feed",
    })

    # --- Feed Posts (others) ---
    p2_pub = await db.post.create(data={
        "userId": u2.id,
        "content": "Hom nay troi dep qua!",
        "visibility": "public",
        "postType": "feed",
    })

    # --- Board Posts ---
    b1 = await db.post.create(data={
        "userId": u1.id,
        "content": "Tim phong tro quanh khu vuc Cau Giay.",
        "visibility": "public",
        "postType": "board",
        "boardTagId": tags[0].id,
    })

    b2 = await db.post.create(data={
        "userId": u3.id,
        "content": "Co ai muon hoc cung mon Python khong?",
        "visibility": "public",
        "postType": "board",
        "boardTagId": tags[5].id,
    })

    print("Seeding interactions...")
    # S2 likes S1's public post
    await db.like.create(data={
        "targetId": p1_pub.id,
        "targetType": "post",
        "userId": u2.id
    })
    await db.post.update(where={"id": p1_pub.id}, data={"likeCount": 1})

    # S1 comments on S2's post
    from prisma import Json
    await db.comment.create(data={
        "targetId": p2_pub.id,
        "targetType": "post",
        "userInfo": Json({
            "id": u1.id,
            "full_name": u1.fullName,
            "avatar_url": u1.avatarUrl
        }),
        "content": "Dung vay, troi rat dep!",
        "replies": Json([])
    })
    await db.post.update(where={"id": p2_pub.id}, data={"commentCount": 1})

    print("Seeding settings...")
    for u in [admin, u1, u2, u3, u4]:
        await db.privacysetting.create(data={"userId": u.id})
        await db.notificationsetting.create(data={"userId": u.id})

    print("Seeding notifications...")
    # Notification for S1 (S2 liked)
    await db.notification.create(data={
        "userId": u1.id,
        "type": "like",
        "title": "Lượt thích mới",
        "content": f"{u2.fullName} đã thích bài viết của bạn.",
        "metadata": Json({"reference_id": p1_pub.id, "reference_type": "post"}),
        "isRead": False,
    })

    # Notification for S2 (S1 commented)
    await db.notification.create(data={
        "userId": u2.id,
        "type": "comment",
        "title": "Bình luận mới",
        "content": f"{u1.fullName} đã bình luận bài viết của bạn.",
        "metadata": Json({"reference_id": p2_pub.id, "reference_type": "post"}),
        "isRead": False,
    })

    print("Database seeded successfully!")
    await db.disconnect()

if __name__ == "__main__":
    asyncio.run(seed())
