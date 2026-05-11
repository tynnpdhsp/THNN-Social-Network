from typing import Optional

from prisma import Prisma, Json
from app.modules.place.schema import (
    NearbyPlaceResponse, PlaceCategoryRequest, PlaceCategoryResponse, 
    PlaceResponse, PlaceImageResponse, UserInfoEmbed)
from prisma.models import Review # type: ignore

class PlaceRepository:
    def __init__(self, db: Prisma):
        self.db = db

    # region --- place category ----
    async def create_place_category(self, data: PlaceCategoryRequest) -> PlaceCategoryResponse:
        return await self.db.placecategory.create(data=data)
    
    async def get_all_category(self) -> list[PlaceCategoryResponse]:
        return await self.db.placecategory.find_many()
    
    async def get_category_by_id(self, category_id: str) -> PlaceCategoryResponse:
        return await self.db.placecategory.find_unique(where={"id": category_id})

    async def get_category_by_name(self, name: str) -> PlaceCategoryResponse:
        return await self.db.placecategory.find_unique(where={"name": name})
    
    async def delete_place_category(self, category_id: str) -> PlaceCategoryResponse:
        return await self.db.placecategory.delete(where={"id": category_id})
    # endregion

    # region --- place CRUD ----
    async def create_place(self, data: dict) -> PlaceResponse:
        return await self.db.place.create(
            data=data,
            include={
                "category": True,
                "user": True,
                "placeImages": True
            }
        )
    
    async def get_place_by_id(self, place_id: str) -> PlaceResponse:
        return await self.db.place.find_unique(
            where={"id": place_id},
            include={
                "category": True,
                "user": True,
                "placeImages": True
            }
        )
    
    async def update_place(self, place_id: str, data: dict) -> PlaceResponse:
        return await self.db.place.update(
            where={"id": place_id},
            data=data,
            include={
                "category": True,
                "user": True,
                "placeImages": True
            }
        )
    
    async def delete_place(self, place_id: str) -> PlaceResponse:
        async with self.db.tx() as tx:
            await tx.placebookmark.delete_many(where={"placeId": place_id})
            await tx.placeimage.delete_many(where={"placeId": place_id})
            await tx.review.delete_many(where={"targetId": place_id, "targetType": "place"})
            return await tx.place.delete(
                where={"id": place_id},
                include={
                    "category": True,
                    "user": True,
                    "placeImages": True
                }
            )
    
    async def filter_places(self, filters: dict) -> list[PlaceResponse]:
        # TODO: Implement place filtering logic
        # For now, return all places with basic filtering
        return await self.db.place.find_many(
            where=filters,
            include={
                "category": True,
                "user": True,
                "placeImages": True
            }
        )
    # endregion

    # region --- place image CRUD ----
    async def create_place_images(self, images_data: list[dict]) -> list[PlaceImageResponse]:
        """Create multiple place images in a transaction"""
        created_images = []
        async with self.db.tx() as tx:
            for image_data in images_data:
                image = await tx.placeimage.create(data=image_data)
                created_images.append(image)
        return created_images
    
    async def get_place_images(self, place_id: str) -> list[PlaceImageResponse]:
        """Get all images for a place"""
        return await self.db.placeimage.find_many(
            where={"placeId": place_id},
            order={"displayOrder": "asc"}
        )
    
    async def delete_place_image(self, image_id: str) -> PlaceImageResponse:
        """Delete a place image"""
        return await self.db.placeimage.delete(where={"id": image_id})
    
    async def get_place_image_by_id(self, image_id: str) -> PlaceImageResponse:
        """Get place image by ID"""
        return await self.db.placeimage.find_unique(where={"id": image_id})
    # endregion

    # region ---------- reviews ---------------
    async def get_user_review(self, place_id: str, user_id: str) -> Review:
        """Get user's existing review for place"""
        # Find review by targetId, targetType and userId in userInfo
        reviews = await self.db.review.find_many(
            where={
                "targetId": place_id,
                "targetType": "place"
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
    
    async def get_place_reviews(self, place_id: str, skip: int = 0, limit: int = 20) -> list[Review]:
        """Get reviews for a place"""
        return await self.db.review.find_many(
            where={
                "targetId": place_id,
                "targetType": "place"
            },
            skip=skip,
            take=limit,
            order={"createdAt": "desc"}
        )
    
    async def count_reviews(self, place_id: str) -> int:
        """Count total reviews for a place"""
        return await self.db.review.count(
            where={
                "targetId": place_id,
                "targetType": "place"
            }
        )

    async def create_review_with_transaction(
        self,
        place_id: str,
        user_id: str,
        user_info: dict,
        rating: int,
        comment: str = None
    ) -> Review:
        """
        flow:
        1. Create/update review
        2. Recalculate avg rating + total reviews
        3. Update place.avgRating + place.ratingCount
        If any step fails -> rollback all
        """
        async with self.db.tx() as tx:
            existing_review = await self.get_user_review(place_id=place_id, user_id=user_id)
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
                        "targetId": place_id,
                        "targetType": "place",
                        "userInfo": Json(user_info),
                        "rating": rating,
                        "comment": comment
                    }
                )

            # Recalculate place rating
            reviews = await tx.review.find_many(
                where={
                    "targetId": place_id,
                    "targetType": "place"
                }
            )
            if not reviews:
                avg_rating = 0.0
                rating_count = 0
            else:
                total_rating = sum(r.rating for r in reviews)
                rating_count = len(reviews)
                avg_rating = round(total_rating / rating_count, 2)

            # Update place rating fields
            await tx.place.update(
                where={
                    "id": place_id
                },
                data={
                    "avgRating": avg_rating,
                    "ratingCount": rating_count
                }
            )

            return review
    
    async def delete_review_with_transaction(
        self,
        review_id: str
    ) -> dict:
        """
        flow:
        1. Find existing review by ID
        2. Delete review
        3. Recalculate avg rating + total reviews
        4. Update place.avgRating + place.ratingCount
        If any step fails -> rollback all
        """
        existing_review = await self.get_review_by_id(review_id)
        if not existing_review:
            raise Exception("Review not found")
        
        place_id = existing_review.targetId
        
        async with self.db.tx() as tx:
            # Delete review
            await tx.review.delete(
                where={
                    "id": review_id
                }
            )
            # Recalculate place rating
            reviews = await tx.review.find_many(
                where={
                    "targetId": place_id,
                    "targetType": "place"
                }
            )

            if not reviews:
                avg_rating = 0.0
                rating_count = 0
            else:
                total_rating = sum(r.rating for r in reviews)
                rating_count = len(reviews)
                avg_rating = round(total_rating / rating_count, 2)

            # Update place rating fields
            await tx.place.update(
                where={
                    "id": place_id
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

    # region ---------- bookmarks ---------------
    async def get_user_bookmark(self, user_id: str, place_id: str):
        """Get user's bookmark for a specific place"""
        return await self.db.placebookmark.find_unique(
            where={
                "userId_placeId": {
                    "userId": user_id,
                    "placeId": place_id
                }
            }
        )
    
    async def create_bookmark(self, user_id: str, place_id: str):
        """Create a bookmark for a place"""
        return await self.db.placebookmark.create(
            data={
                "userId": user_id,
                "placeId": place_id
            }
        )
    
    async def delete_bookmark(self, user_id: str, place_id: str):
        """Delete a bookmark for a place"""
        return await self.db.placebookmark.delete(
            where={
                "userId_placeId": {
                    "userId": user_id,
                    "placeId": place_id
                }
            }
        )
    
    async def get_user_bookmarks(self, user_id: str, skip: int = 0, limit: int = 20):
        """Get all bookmarks for a user with place details"""
        return await self.db.placebookmark.find_many(
            where={"userId": user_id},
            skip=skip,
            take=limit,
            order={"createdAt": "desc"},
            include={
                "place": {
                    "include": {
                        "category": True,
                        "user": True
                    }
                }
            }
        )
    
    async def count_user_bookmarks(self, user_id: str) -> int:
        """Count total bookmarks for a user"""
        return await self.db.placebookmark.count(
            where={"userId": user_id}
        )
    # endregion

    # region ---------- nearby places ---------------
    async def get_nearby_places(self, lat: float, lng: float, radius: float, category_id: Optional[str] = None):
        """Get nearby places using Haversine formula"""
        import math
        
        # Get all places (or filter by category if provided)
        where_condition = {}
        if category_id:
            where_condition["categoryId"] = category_id
            
        places = await self.db.place.find_many(
            where=where_condition,
            include={
                "category": True,
                "user": True,
                "placeImages": True
            }
        )
        
        # Calculate distance using Haversine formula
        nearby_places = []
        R = 6371  # Earth's radius in kilometers
        
        for place in places:
            # Convert latitude and longitude to radians
            lat1 = math.radians(lat)
            lng1 = math.radians(lng)
            lat2 = math.radians(place.latitude)
            lng2 = math.radians(place.longitude)
            
            # Haversine formula
            dlat = lat2 - lat1
            dlng = lng2 - lng1
            a = (math.sin(dlat/2)**2 + 
                 math.cos(lat1) * math.cos(lat2) * math.sin(dlng/2)**2)
            c = 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))
            distance = R * c
            
            # Filter by radius
            if distance <= radius:
                # Map place to response with calculated distance
                response = self._map_nearby_place_to_response(place, distance)
                nearby_places.append(response)
        
        # Sort by distance (ascending)
        nearby_places.sort(key=lambda x: x.distance)
        
        return nearby_places
    # endregion

    def _map_nearby_place_to_response(self, place, distance):
        """Map Place model to NearbyPlaceResponse"""
        user_info = None
        if hasattr(place, "user") and place.user:
            user_info = UserInfoEmbed(id=place.user.id, full_name=place.user.fullName, avatar_url=place.user.avatarUrl)

        category = None
        if hasattr(place, "category") and place.category:
            category = PlaceCategoryResponse(id=place.category.id, name=place.category.name, icon=place.category.icon)

        images = []
        if hasattr(place, "placeImages") and place.placeImages:
            for img in place.placeImages:
                images.append(PlaceImageResponse(
                    id=img.id,
                    place_id=img.placeId,
                    image_url=img.imageUrl,
                    display_order=img.displayOrder,
                    created_at=img.createdAt
                ))
        elif hasattr(place, "images") and place.images: # Fallback
            for img in place.images:
                images.append(PlaceImageResponse(
                    id=img.id,
                    place_id=img.placeId,
                    image_url=img.imageUrl,
                    display_order=img.displayOrder,
                    created_at=img.createdAt
                ))

        return NearbyPlaceResponse(
            id=place.id,
            name=place.name,
            description=place.description,
            latitude=place.latitude,
            longitude=place.longitude,
            address=place.address,
            avg_rating=place.avgRating,
            rating_count=place.ratingCount,
            distance=distance,  # Distance calculated by Haversine
            user_info=user_info or None,
            category=category or None,
            images=images
        )