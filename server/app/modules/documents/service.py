from app.modules.documents.repository import DocumentRepository
from app.modules.documents.schema import (
    DocumentCategoryResponse, DocumentCategoryRequest, DocumentCreate, DocumentUpdate, DocumentResponse, DocumentListQuery, DocumentListResponse,
    UserInfoEmbed, DocumentPaginationRequest, ReviewCreate, ReviewResponse, ReviewListResponse)
from app.core.exceptions import ConflictException, NotFoundException, ForbiddenException
from prisma.models import Document # type: ignore
import os
import logging
from app.utils.storage import delete_file

logger = logging.getLogger(__name__)

class DocumentService:
    def __init__(self, repo: DocumentRepository):
        self.repo = repo

    # region---- category ----
    async def create_document_category(self, data: DocumentCategoryRequest) -> DocumentCategoryResponse:
        existing = await self.repo.get_category_by_name(data.name)
        if existing:
            raise ConflictException("Category name already exists", "CATEGORY_NAME_EXISTS")
        
        return await self.repo.create_document_category(data.model_dump())
    
    async def get_all_category(self) -> list[DocumentCategoryResponse]:
        categories = await self.repo.get_all_category()
        return [DocumentCategoryResponse.model_validate(cate) for cate in categories]
    
    async def update_document_category(self, category_id: str, data: DocumentCategoryRequest) -> DocumentCategoryResponse:
        existing_category = await self.repo.get_category_by_id(category_id)
        if not existing_category:
            raise NotFoundException("Category not found", "CATEGORY_NOT_FOUND")
        
        existing_by_name = await self.repo.get_category_by_name(data.name)
        if existing_by_name and existing_by_name.id != category_id:
            raise ConflictException("Category name already exists", "CATEGORY_NAME_EXISTS")
        
        updated_category = await self.repo.update_document_category(category_id, data.model_dump())
        return DocumentCategoryResponse.model_validate(updated_category)
    
    async def delete_document_category(self, category_id: str) -> DocumentCategoryResponse:
        existing_category = await self.repo.get_category_by_id(category_id)
        if not existing_category:
            raise NotFoundException("Category not found", "CATEGORY_NOT_FOUND")
        
        deleted_category = await self.repo.delete_document_category(category_id)
        return DocumentCategoryResponse.model_validate(deleted_category)
    # endregion

    # region ---- documents ----
    async def upload_document(self, data: DocumentCreate, file_content: bytes, filename: str, user_id: str) -> DocumentResponse:
        """Upload document with transaction"""
        file_url = None
        
        try:
            # Upload file to MinIO
            from app.utils.storage import upload_file
            file_url = await upload_file(file_content, filename, f"documents/{user_id}")
            
            document_data = {
                "userId": user_id,
                "categoryId": data.category_id or None,
                "title": data.title,
                "description": data.description,
                "fileUrl": file_url,
                "fileName": filename,
                "fileSize": len(file_content),
                "fileType": self._get_file_type(filename)
            }
            
            # Create document in database
            document = await self.repo.create_document(document_data)
            
            return self._map_document_to_response(document)
            
        except Exception as e:
            # If database insert failed, delete uploaded file
            if file_url:
                try:
                    await delete_file(file_url)
                except Exception:
                    # Ignore deletion errors during rollback
                    pass
            raise e

    async def get_documents(self, query: DocumentListQuery) -> DocumentListResponse:
        """Get documents with pagination, sorting and filtering"""
        # Get documents and total count
        documents = await self.repo.get_documents(
            skip=query.skip,
            limit=query.limit,
            sort=query.sort,
            category_id=query.category_id,
            search=query.search
        )
        
        total = await self.repo.count_documents(
            category_id=query.category_id,
            search=query.search
        )
        
        items = [self._map_document_to_response(doc) for doc in documents]
        
        return DocumentListResponse(
            total=total,
            items=items,
            skip=query.skip,
            limit=query.limit
        )
    
    async def get_document_by_id(self, document_id: str) -> DocumentResponse:
        return self._map_document_to_response(await self.repo.get_document_by_id(document_id))
    
    async def get_my_documents(self, user_id: str, query: DocumentPaginationRequest) -> list[DocumentResponse]:
        documents = await self.repo.get_my_documents(user_id, query.skip, query.limit)
        total = await self.repo.count_documents(None, None, user_id)

        return DocumentListResponse(
            total = total,
            items = [self._map_document_to_response(doc) for doc in documents],
            skip=query.skip,
            limit=query.limit
        )

    async def delete_document(self, document_id: str, user_id: str) -> DocumentResponse:
        """Delete document with file cleanup and cache invalidation"""
        # Get document first to check ownership and get file info
        document = await self.repo.get_document_by_id(document_id)
        if not document:
            raise NotFoundException("Document not found", "DOCUMENT_NOT_FOUND")
        
        # Check ownership (only owner can delete)
        if document.userId != user_id:
            raise ForbiddenException("Access denied", "ACCESS_DENIED")
        
        try:
            # Delete document from database
            deleted_document = await self.repo.delete_document(document_id)
            
            # Delete file from MinIO
            try:
                await delete_file(document.fileUrl)
            except Exception as e:
                # Log error but don't fail the operation
                logger.warning(f"Failed to delete file {document.fileUrl}: {e}")
            
            # Invalidate cache
            # try:
            #     from app.utils.cache import invalidate_document_cache
            #     await invalidate_document_cache(document_id)
            # except Exception as e:
            #     # Log error but don't fail the operation
            #     print(f"Failed to invalidate cache for document {document_id}: {e}")
            
            return self._map_document_to_response(deleted_document)
            
        except Exception as e:
            raise e

    async def update_document(self, document_id: str, data: DocumentUpdate, user_id: str) -> DocumentResponse:
        """Update document with cache invalidation"""
        document = await self.repo.get_document_by_id(document_id)
        if not document:
            raise NotFoundException("Document not found", "DOCUMENT_NOT_FOUND")
        
        # Check ownership (only owner can update)
        if document.userId != user_id:
            raise ForbiddenException("Access denied", "ACCESS_DENIED")
        
        # Prepare update data (only include non-None fields)
        update_data = {}
        if data.title is not None:
            update_data["title"] = data.title
        if data.description is not None:
            update_data["description"] = data.description
        if data.category_id is not None:
            update_data["categoryId"] = data.category_id
        
        if not update_data:
            raise ValueError("No fields to update")
        
        try:
            updated_document = await self.repo.update_document(document_id, update_data)
            
            # Invalidate cache
            # try:
            #     from app.utils.cache import invalidate_document_cache
            #     await invalidate_document_cache(document_id)
            # except Exception as e:
            #     # Log error but don't fail the operation
            #     print(f"Failed to invalidate cache for document {document_id}: {e}")
            
            return self._map_document_to_response(updated_document)
            
        except Exception as e:
            raise e
    # endregion

    # region ---- Reviews ----
    async def create_document_review(self, document_id: str, user_id: str, data: ReviewCreate) -> ReviewResponse:
        """Create or update review for document with transaction"""
        document = await self.repo.get_document_by_id(document_id)
        if not document:
            raise NotFoundException("Document not found", "DOCUMENT_NOT_FOUND")
        
        user = await self.repo.db.user.find_unique(where={"id": user_id})
        if not user:
            raise NotFoundException("User not found", "USER_NOT_FOUND")
        
        user_info = {
            "id": user.id,
            "full_name": user.fullName,
            "avatar_url": user.avatarUrl or None
        }
        
        review, rating_data = await self.repo.create_review_with_transaction(
            document_id, user_id, user_info, data.rating, data.comment
        )
        
        return self._map_review_to_response(review)
    
    async def get_document_reviews(self, document_id: str, skip: int = 0, limit: int = 20) -> ReviewListResponse:
        """Get reviews for a document with pagination"""
        # Check if document exists
        document = await self.repo.get_document_by_id(document_id)
        if not document:
            raise NotFoundException("Document not found", "DOCUMENT_NOT_FOUND")
        
        reviews = await self.repo.get_document_reviews(document_id, skip, limit)
        total = await self.repo.count_reviews(document_id)
        
        items = [self._map_review_to_response(review) for review in reviews]
        
        return ReviewListResponse(
            total=total,
            items=items,
            skip=skip,
            limit=limit
        )
    
    async def delete_document_review(self, review_id: str, user_id: str) -> dict:
        """Delete review for document with transaction"""
        review = await self.repo.get_review_by_id(review_id)
        if not review:
            raise NotFoundException("Review not found", "REVIEW_NOT_FOUND")
        
        # Check if user owns this review
        user_info = review.userInfo if isinstance(review.userInfo, dict) else {}
        if user_info.get("id") != user_id:
            raise ForbiddenException("Can't access to delete review", "Forbidden_DELETE_REVIEW")
        
        result = await self.repo.delete_review_with_transaction(review_id)
        
        # Invalidate cache
        # try:
        #     from app.utils.cache import invalidate_document_cache
        #     await invalidate_document_cache(review.targetId)
        # except Exception as e:
        #     print(f"Failed to invalidate cache for document {review.targetId}: {e}")
        
        return result
    
    # endregion

 # region ---- Helper ----
    def _get_file_type(self, filename: str) -> str:
        """Extract file type from filename"""
        return os.path.splitext(filename)[1].lower() if '.' in filename else 'unknown'

    def _map_document_to_response(self, document: Document) -> DocumentResponse:
        """Map Document model to DocumentResponse"""
        user_info = None
        if hasattr(document, "user") and document.user:
            user_info = UserInfoEmbed(id=document.user.id, full_name=document.user.fullName, avatar_url=document.user.avatarUrl)

        category = None
        if hasattr(document, "category") and document.category:
            category = DocumentCategoryResponse(id=document.category.id, name=document.category.name)

        return DocumentResponse(
            id=document.id,
            title=document.title,
            description=document.description,
            file_url=document.fileUrl,
            file_name=document.fileName,
            file_size=document.fileSize,
            file_type=document.fileType,
            avg_rating=document.avgRating,
            rating_count=document.ratingCount,
            download_count=document.downloadCount,
            created_at=document.createdAt,
            updated_at=document.updatedAt,
            user_info=user_info,
            category=category
        )

    def _map_review_to_response(self, review) -> ReviewResponse:
        """Map Review model to ReviewResponse"""
        user_info = review.userInfo if isinstance(review.userInfo, dict) else {}
        
        return ReviewResponse(
            id=review.id,
            target_id=review.targetId,
            target_type=review.targetType,
            user_info=UserInfoEmbed(
                id=user_info.get("id", ""),
                full_name=user_info.get("full_name", ""),
                avatar_url=user_info.get("avatar_url")
            ),
            rating=review.rating,
            comment=review.comment,
            created_at=review.createdAt
        )
    # endregion
