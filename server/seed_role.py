import asyncio
from prisma import Prisma

async def main():
    db = Prisma()
    await db.connect()
    
    existing = await db.role.find_first(where={"role": "student"})
    if not existing:
        role = await db.role.create(data={
            "role": "student"
        })
        print("Created role:", role.role)
    else:
        print("Role 'student' already exists.")
        
    await db.disconnect()

if __name__ == '__main__':
    asyncio.run(main())
