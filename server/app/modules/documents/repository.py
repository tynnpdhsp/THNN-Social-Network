from prisma import Prisma
from prisma.models import DocumentCategory, Document, Review, User # type: ignore
from app.modules.documents.schema import DocumentCategoryRequest, DocumentCreate
from datetime import datetime
from prisma import Json

class DocumentRepository:
    def __init__(self, db: Prisma):
        self.db = db

    # region--- Document Category -----
    async def get_category_by_name(self, name: str) -> DocumentCategory:
        return await self.db.documentcategory.find_unique(where={"name": name})
    
    async def create_document_category(self, data: DocumentCategoryRequest) -> DocumentCategory:
        return await self.db.documentcategory.create(data=data)
    
    async def get_all_category(self) -> list[DocumentCategory]:
        return await self.db.documentcategory.find_many(order={"createdAt": "asc"})
    
    async def get_category_by_id(self, category_id: str) -> DocumentCategory:
        return await self.db.documentcategory.find_unique(where={"id": category_id})
    
    async def update_document_category(self, category_id: str, data: dict) -> DocumentCategory:
        return await self.db.documentcategory.update(
            where={"id": category_id},
            data=data
        )
    
    async def delete_document_category(self, category_id: str) -> DocumentCategory:
        return await self.db.documentcategory.delete(where={"id": category_id})
    # endregion
    
    # region --- Documents -----
    async def create_document(self, data: dict) -> Document:
        return await self.db.document.create(data=data)
    
    async def get_documents(self, skip: int, limit: int, sort: str, category_id: str = None, search: str = None) -> list[Document]:
        """Get documents with filtering and sorting"""
        where_conditions = {}
        
        # Category filter
        if category_id:
            where_conditions["categoryId"] = category_id
        
        # Search filter
        if search:
            where_conditions["OR"] = [
                {"title": {"contains": search, "mode": "insensitive"}},
                {"description": {"contains": search, "mode": "insensitive"}}
            ]
        
        # Sort mapping
        sort_mapping = {
            "rating": {"avgRating": "desc"},
            "popular": {"downloadCount": "desc"},
            "newest": {"createdAt": "desc"},
            "oldest": {"createdAt": "asc"}
        }
        
        order_by = sort_mapping.get(sort, {"createdAt": "desc"})
        
        return await self.db.document.find_many(
            where=where_conditions,
            include={"user": True, "category": True},
            skip=skip,
            take=limit,
            order=order_by
        )
    
    async def get_my_documents(self, user_id, skip, limit) -> list[Document]:
        return await self.db.document.find_many(
            where=({"userId": user_id}),
            include={"category": True},
            skip=skip,
            take=limit
        )
    
    async def count_documents(self, category_id: str = None, search: str = None, user_id: str = None) -> int:
        """Count documents with filtering"""
        where_conditions = {}
        
        if user_id:
            where_conditions["userId"] = user_id

        # Category filter
        if category_id:
            where_conditions["categoryId"] = category_id
        
        # Search filter
        if search:
            where_conditions["OR"] = [
                {"title": {"contains": search, "mode": "insensitive"}},
                {"description": {"contains": search, "mode": "insensitive"}}
            ]
        
        return await self.db.document.count(where=where_conditions)
    
    async def get_document_by_id(self, document_id: str) -> Document:
        """Get document by ID with user info"""
        return await self.db.document.find_unique(
            where={"id": document_id},
            include={"user": True, "category": True}
        )
    
    async def delete_document(self, document_id: str) -> Document:
        """Delete document by ID"""
        return await self.db.document.delete(where={"id": document_id})
    
    async def update_document(self, document_id: str, data: dict) -> Document:
        """Update document by ID"""
        return await self.db.document.update(
            where={"id": document_id},
            data=data,
        )

    # region --- Reviews -----
    async def get_user_review(self, document_id: str, user_id: str) -> Review:
        """Get user's existing review for document"""
        # Find review by targetId, targetType and userId in userInfo
        reviews = await self.db.review.find_many(
            where={
                "targetId": document_id,
                "targetType": "document"
            }
        )
        
        # Filter by user_id in userInfo
        for review in reviews:
            if isinstance(review.userInfo, dict) and review.userInfo.get("id") == user_id:
                return review
        return None
    
    async def get_review_by_id(self, review_id: str) -> Review:
        """Get review by ID"""
        return await self.db.review.find_unique(where={"id": review_id})
    
    async def get_document_reviews(self, document_id: str, skip: int = 0, limit: int = 20) -> list[Review]:
        """Get reviews for a document"""
        return await self.db.review.find_many(
            where={
                "targetId": document_id,
                "targetType": "document"
            },
            skip=skip,
            take=limit,
            order={"createdAt": "desc"}
        )
    
    async def count_reviews(self, document_id: str) -> int:
        """Count total reviews for a document"""
        return await self.db.review.count(
            where={
                "targetId": document_id,
                "targetType": "document"
            }
        )

    async def create_review_with_transaction(
        self,
        document_id: str,
        user_id: str,
        user_info: dict,
        rating: int,
        comment: str = None
    ) -> tuple[Review, dict]:
        """
        flow:
        1. Create/update review
        2. Recalculate avg rating + total reviews
        3. Update document.avgRating + document.ratingCount
        If any step fails -> rollback all
        """
        async with self.db.tx() as tx:
            existing_review = await self.get_user_review(document_id=document_id, user_id=user_id)
            # Update or Create review
            if existing_review:
                review = await tx.review.update(
                    where={
                        "id": existing_review.id
                    },
                    data={
                        "rating": rating,
                        "comment": comment
                    }
                )
            else:
                review = await tx.review.create(
                    data={
                        "targetId": document_id,
                        "targetType": "document",
                        "userInfo": Json(user_info),
                        "rating": rating,
                        "comment": comment
                    }
                )

            # Recalculate document rating
            reviews = await tx.review.find_many(
                where={
                    "targetId": document_id,
                    "targetType": "document"
                }
            )
            if not reviews:
                avg_rating = 0.0
                rating_count = 0
            else:
                total_rating = sum(r.rating for r in reviews)
                rating_count = len(reviews)
                avg_rating = round(total_rating / rating_count, 2)

            # Update document rating fields
            await tx.document.update(
                where={
                    "id": document_id
                },
                data={
                    "avgRating": avg_rating,
                    "ratingCount": rating_count
                }
            )

            return review, {
                "avg_rating": avg_rating,
                "rating_count": rating_count
            }
    
    async def delete_review_with_transaction(
        self,
        review_id: str
    ) -> dict:
        """
        flow:
        1. Find existing review by ID
        2. Delete review
        3. Recalculate avg rating + total reviews
        4. Update document.avgRating + document.ratingCount
        If any step fails -> rollback all
        """
        existing_review = await self.get_review_by_id(review_id)
        if not existing_review:
            raise Exception("Review not found")
        
        document_id = existing_review.targetId
        
        async with self.db.tx() as tx:
            # Delete review
            await tx.review.delete(
                where={
                    "id": review_id
                }
            )
            # Recalculate document rating
            reviews = await tx.review.find_many(
                where={
                    "targetId": document_id,
                    "targetType": "document"
                }
            )

            if not reviews:
                avg_rating = 0.0
                rating_count = 0
            else:
                total_rating = sum(r.rating for r in reviews)
                rating_count = len(reviews)
                avg_rating = round(total_rating / rating_count, 2)

            # Update document rating fields
            await tx.document.update(
                where={
                    "id": document_id
                },
                data={
                    "avgRating": avg_rating,
                    "ratingCount": rating_count
                }
            )

            return {
                "avg_rating": avg_rating,
                "rating_count": rating_count,
                "message": "Review deleted successfully"
            }
    # endregion