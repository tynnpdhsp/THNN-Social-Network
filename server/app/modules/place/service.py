from typing import Optional

from app.core.exceptions import ConflictException, ForbiddenException, NotFoundException
from app.modules.documents.schema import ReviewCreate, ReviewResponse
from app.modules.place.schema import (
    PlaceCategoryRequest, PlaceCategoryResponse, PlaceRequest, 
    PlaceUpdateRequest, PlaceResponse, PlaceImageResponse, ReviewListResponse,
    UserInfoEmbed, BookmarkResponse, BookmarkPlaceResponse, BookmarkListResponse, BookmarkCheckResponse, NearbyPlacesListResponse)
from app.modules.place.repository import PlaceRepository
from app.utils.storage import upload_files, delete_file

class PlaceService:
    def __init__(self, repo: PlaceRepository):
        self.repo = repo

    # region---- category ----
    async def create_place_category(self, data: PlaceCategoryRequest) -> PlaceCategoryResponse:
        existing = await self.repo.get_category_by_name(data.name)
        if existing:
            raise ConflictException("Category name already exists", "CATEGORY_NAME_EXISTS")
        
        return await self.repo.create_place_category(data.model_dump())
    
    async def get_all_category(self) -> list[PlaceCategoryResponse]:
        categories = await self.repo.get_all_category()
        return [PlaceCategoryResponse.model_validate(cate) for cate in categories]
    
    async def delete_place_category(self, category_id: str) -> PlaceCategoryResponse:
        existing_category = await self.repo.get_category_by_id(category_id)
        if not existing_category:
            raise NotFoundException("Category not found", "CATEGORY_NOT_FOUND")
        
        deleted_category = await self.repo.delete_place_category(category_id)
        return PlaceCategoryResponse.model_validate(deleted_category)
    # endregion

    # region---- place CRUD ----
    async def create_place(self, data: PlaceRequest, user_id: str) -> PlaceResponse:
        category = await self.repo.get_category_by_id(data.category_id)
        if not category:
            raise NotFoundException("Category not found", "CATEGORY_NOT_FOUND")
        
        place_data = {
            "name": data.name,
            "description": data.description,
            "latitude": data.latitude,
            "longitude": data.longitude,
            "address": data.address,
            "categoryId": data.category_id,
            "userId": user_id
        }
        
        created_place = await self.repo.create_place(place_data)
        return self._map_place_to_response(created_place)
    
    async def get_place_by_id(self, place_id: str) -> PlaceResponse:
        place = await self.repo.get_place_by_id(place_id)
        if not place:
            raise NotFoundException("Place not found", "PLACE_NOT_FOUND")
        
        return self._map_place_to_response(place)
    
    async def update_place(self, place_id: str, data: PlaceUpdateRequest, user_id: str) -> PlaceResponse:
        # Verify place exists and user owns it
        existing_place = await self.repo.get_place_by_id(place_id)
        if not existing_place:
            raise NotFoundException("Place not found", "PLACE_NOT_FOUND")
        
        if existing_place.userId != user_id:
            raise ConflictException("You can only update your own places", "NOT_PLACE_OWNER")
        
        # Build update data with only provided fields
        place_data = {}
        
        if data.name is not None:
            place_data["name"] = data.name
        if data.description is not None:
            place_data["description"] = data.description
        if data.latitude is not None:
            place_data["latitude"] = data.latitude
        if data.longitude is not None:
            place_data["longitude"] = data.longitude
        if data.address is not None:
            place_data["address"] = data.address
        if data.category_id is not None:
            # Verify category exists if provided
            category = await self.repo.get_category_by_id(data.category_id)
            if not category:
                raise NotFoundException("Category not found", "CATEGORY_NOT_FOUND")
            place_data["categoryId"] = data.category_id
        
        # Check if there's anything to update
        if not place_data:
            raise ConflictException("No fields provided for update", "NO_UPDATE_FIELDS")
        
        updated_place = await self.repo.update_place(place_id, place_data)
        return self._map_place_to_response(updated_place)
    
    async def delete_place(self, place_id: str, user_id: str) -> PlaceResponse:
        # Verify place exists and user owns it
        existing_place = await self.repo.get_place_by_id(place_id)
        if not existing_place:
            raise NotFoundException("Place not found", "PLACE_NOT_FOUND")
        
        if existing_place.userId != user_id:
            raise ConflictException("You can only delete your own places", "NOT_PLACE_OWNER")
        
        deleted_place = await self.repo.delete_place(place_id)
        return self._map_place_to_response(deleted_place)

    # region---- place image CRUD ----
    async def create_place_images(self, place_id: str, files: list, user_id: str) -> list[PlaceImageResponse]:
        """Upload multiple images for a place with transaction"""
        # Verify place exists and user owns it
        existing_place = await self.repo.get_place_by_id(place_id)
        if not existing_place:
            raise NotFoundException("Place not found", "PLACE_NOT_FOUND")
        
        if existing_place.userId != user_id:
            raise ForbiddenException("You can only add images to your own places", "NOT_PLACE_OWNER")
        
        uploaded_urls = []
        try:
            # Convert UploadFile objects to (content, filename) tuples
            file_tuples = []
            for file in files:
                content = await file.read()
                filename = file.filename
                file_tuples.append((content, filename))
            
            uploaded_urls = await upload_files(files=file_tuples, prefix=f"place_images/{place_id}")
            
            images_data = []
            for i, url in enumerate(uploaded_urls):
                images_data.append({
                    "placeId": place_id,
                    "imageUrl": url,
                    "displayOrder": i
                })
            
            created_images = await self.repo.create_place_images(images_data)
            return [self._map_place_image_to_response(img) for img in created_images]
            
        except Exception as e:
            # If database operation fails, delete uploaded files
            if uploaded_urls:
                for url in uploaded_urls:
                    await delete_file(url)
            raise e
    
    async def get_place_images(self, place_id: str) -> list[PlaceImageResponse]:
        """Get all images for a place (public)"""
        images = await self.repo.get_place_images(place_id)
        return [self._map_place_image_to_response(img) for img in images]
    
    async def delete_place_image(self, image_id: str, user_id: str) -> PlaceImageResponse:
        """Delete a place image with authentication"""
        # Get image to verify ownership
        image = await self.repo.get_place_image_by_id(image_id)
        if not image:
            raise NotFoundException("Image not found", "IMAGE_NOT_FOUND")
        
        # Get place to verify ownership
        place = await self.repo.get_place_by_id(image.placeId)
        if not place:
            raise NotFoundException("Place not found", "PLACE_NOT_FOUND")
        
        if place.userId != user_id:
            raise ConflictException("You can only delete images from your own places", "NOT_PLACE_OWNER")
        
        # Delete file from storage
        try:
            await delete_file(image.imageUrl)
        except Exception:
            # Continue even if file deletion fails
            pass
        
        # Delete database record
        deleted_image = await self.repo.delete_place_image(image_id)
        return self._map_place_image_to_response(deleted_image)
    # endregion

    # region ---- reviews -----
    async def create_place_review(self, place_id: str, user_id: str, data: ReviewCreate) -> ReviewResponse:
        """Create or update review for place with transaction"""
        place = await self.repo.get_place_by_id(place_id)
        if not place:
            raise NotFoundException("Place not found", "PLACE_NOT_FOUND")
        
        user = await self.repo.db.user.find_unique(where={"id": user_id})
        if not user:
            raise NotFoundException("User not found", "USER_NOT_FOUND")
        
        user_info = {
            "id": user.id,
            "full_name": user.fullName,
            "avatar_url": user.avatarUrl or None
        }
        
        review = await self.repo.create_review_with_transaction(
            place_id, user_id, user_info, data.rating, data.comment
        )
        
        return self._map_review_to_response(review)
    
    async def get_place_reviews(self, place_id: str, skip: int = 0, limit: int = 20) -> ReviewListResponse:
        """Get reviews for a place with pagination"""
        # Check if place exists
        place = await self.repo.get_place_by_id(place_id)
        if not place:
            raise NotFoundException("Place not found", "PLACE_NOT_FOUND")
        
        reviews = await self.repo.get_place_reviews(place_id, skip, limit)
        total = await self.repo.count_reviews(place_id)
        
        items = [self._map_review_to_response(review) for review in reviews]
        
        return ReviewListResponse(
            total=total,
            items=items,
            skip=skip,
            limit=limit
        )
    
    async def delete_place_review(self, review_id: str, user_id: str) -> dict:
        """Delete review for place with transaction"""
        review = await self.repo.get_review_by_id(review_id)
        if not review:
            raise NotFoundException("Review not found", "REVIEW_NOT_FOUND")
        
        # Check if user owns this review
        user_info = review.userInfo if isinstance(review.userInfo, dict) else {}
        if user_info.get("id") != user_id:
            raise ForbiddenException("Can't access to delete review", "Forbidden_DELETE_REVIEW")
        
        result = await self.repo.delete_review_with_transaction(review_id)
        
        return result
    
    # endregion

    # region ---- bookmarks -----
    async def toggle_place_bookmark(self, place_id: str, user_id: str) -> BookmarkResponse:
        """Toggle bookmark for a place (create if not exists, delete if exists)"""
        place = await self.repo.get_place_by_id(place_id)
        if not place:
            raise NotFoundException("Place not found", "PLACE_NOT_FOUND")
        
        existing_bookmark = await self.repo.get_user_bookmark(user_id, place_id)
        
        if existing_bookmark:
            deleted_bookmark = await self.repo.delete_bookmark(user_id, place_id)
            return BookmarkResponse.model_validate(deleted_bookmark)
        else:
            created_bookmark = await self.repo.create_bookmark(user_id, place_id)
            return BookmarkResponse.model_validate(created_bookmark)
    
    async def get_user_bookmarks(self, user_id: str, skip: int = 0, limit: int = 20) -> BookmarkListResponse:
        """Get user's bookmarked places with pagination"""
        bookmarks = await self.repo.get_user_bookmarks(user_id, skip, limit)
        total = await self.repo.count_user_bookmarks(user_id)
        
        items = [self._map_bookmark_to_response(bookmark) for bookmark in bookmarks]
        
        return BookmarkListResponse(
            total=total,
            items=items,
            skip=skip,
            limit=limit
        )
    
    async def check_place_bookmark(self, place_id: str, user_id: str) -> BookmarkCheckResponse:
        """Check if user has bookmarked a specific place"""
        place = await self.repo.get_place_by_id(place_id)
        if not place:
            raise NotFoundException("Place not found", "PLACE_NOT_FOUND")
        
        bookmark = await self.repo.get_user_bookmark(user_id, place_id)
        
        if bookmark:
            return BookmarkCheckResponse(
                is_bookmarked=True,
                bookmark_id=bookmark.id
            )
        else:
            return BookmarkCheckResponse(
                is_bookmarked=False,
                bookmark_id=None
            )
    
    # endregion

    # region ---- nearby places -----
    async def get_nearby_places(self, lat: float, lng: float, radius: float = 2.0, category_id: Optional[str] = None) -> NearbyPlacesListResponse:
        """Get nearby places within radius using Haversine formula"""
        # Validate coordinates
        if not (-90 <= lat <= 90):
            raise ValueError("Latitude must be between -90 and 90")
        if not (-180 <= lng <= 180):
            raise ValueError("Longitude must be between -180 and 180")
        if radius <= 0:
            raise ValueError("Radius must be greater than 0")
        
        # Validate category if provided
        if category_id:
            category = await self.repo.get_category_by_id(category_id)
            if not category:
                raise NotFoundException("Category not found", "CATEGORY_NOT_FOUND")
        
        # Get nearby places from repository
        nearby_places = await self.repo.get_nearby_places(lat, lng, radius, category_id)
        
        # Map to response format
        # items = [self._map_nearby_place_to_response(place) for place in nearby_places]
        
        return NearbyPlacesListResponse(data=nearby_places)
    
    # endregion
    
    # region ----- Helper -----
    def _map_place_to_response(self, place) -> PlaceResponse:
        """Map Place model to PlaceResponse"""
        user_info = None
        if hasattr(place, "user") and place.user:
            user_info = UserInfoEmbed(id=place.user.id, full_name=place.user.fullName, avatar_url=place.user.avatarUrl)

        category = None
        if hasattr(place, "category") and place.category:
            category = PlaceCategoryResponse(id=place.category.id, name=place.category.name, icon=place.category.icon)

        images = None
        if hasattr(place, "placeImages") and place.placeImages:
            images = [self._map_place_image_to_response(img) for img in place.placeImages]
        elif hasattr(place, "images") and place.images:
            images = [self._map_place_image_to_response(img) for img in place.images]

        return PlaceResponse(
            id=place.id,
            name=place.name,
            description=place.description,
            latitude=place.latitude,
            longitude=place.longitude,
            address=place.address,
            avg_rating=place.avgRating,
            rating_count=place.ratingCount,
            created_at=place.createdAt,
            updated_at=place.updatedAt,
            user_info=user_info or None,
            category=category or None,
            images=images
        )

    def _map_review_to_response(self, review) -> ReviewResponse:
        """Map Review model to ReviewResponse"""
        # Handle userInfo - it could be a dict or already a UserInfoEmbed object
        if isinstance(review.userInfo, dict):
            user_info = UserInfoEmbed(
                id=review.userInfo.get("id", ""), 
                full_name=review.userInfo.get("full_name", review.userInfo.get("fullName", "")), 
                avatar_url=review.userInfo.get("avatar_url", review.userInfo.get("avatarUrl"))
            )
        else:
            user_info = review.userInfo
        
        return ReviewResponse(
            id=review.id,
            target_id=review.targetId,
            target_type=review.targetType,
            user_info=user_info.model_dump(),
            rating=review.rating,
            comment=review.comment,
            created_at=review.createdAt
        )

    def _map_bookmark_to_response(self, bookmark) -> BookmarkPlaceResponse:
        """Map Bookmark model to BookmarkPlaceResponse"""
        place = bookmark.place
        
        user_info = None
        if hasattr(place, "user") and place.user:
            user_info = UserInfoEmbed(id=place.user.id, full_name=place.user.fullName, avatar_url=place.user.avatarUrl)

        category = None
        if hasattr(place, "category") and place.category:
            category = PlaceCategoryResponse(id=place.category.id, name=place.category.name, icon=place.category.icon)

        return BookmarkPlaceResponse(
            id=place.id,
            name=place.name,
            description=place.description,
            latitude=place.latitude,
            longitude=place.longitude,
            address=place.address,
            avg_rating=place.avgRating,
            rating_count=place.ratingCount,
            created_at=place.createdAt,
            user_info=user_info or None,
            category=category or None,
            bookmarked_at=bookmark.createdAt
        )

    def _map_place_image_to_response(self, image) -> PlaceImageResponse:
        """Map PlaceImage model to PlaceImageResponse"""
        return PlaceImageResponse(
            id=image.id,
            place_id=image.placeId,
            image_url=image.imageUrl,
            display_order=image.displayOrder,
            created_at=image.createdAt
        )
    # endregion