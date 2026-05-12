from fastapi import APIRouter, UploadFile, File, Form, Query # type: ignore
from typing import Optional
from app.modules.place.schema import (
    PlaceCategoryRequest, PlaceCategoryResponse,
    PlaceRequest, PlaceResponse,
    PlaceImageRequest, PlaceImageResponse,
    ReviewRequest, ReviewResponse, ReviewListResponse,
    BookmarkResponse, BookmarkListResponse, BookmarkCheckResponse,
    NearbyPlacesListResponse, PlaceUpdateRequest)
from app.modules.place.service import PlaceService
from app.core.dependencies import Depends, get_place_service, require_admin, require_active_user

router = APIRouter(prefix="/place", tags=["Place"])

# region------------- place category -------------------------- 

@router.post("/categories", response_model=PlaceCategoryResponse)
async def create_place_category(
    data: PlaceCategoryRequest,
    admin_id = Depends(require_admin),
    svc: PlaceService = Depends(get_place_service)
):
    return await svc.create_place_category(data)

@router.get("/categories", response_model=list[PlaceCategoryResponse])
async def get_all_category(svc: PlaceService =Depends(get_place_service)):
    return await svc.get_all_category()

@router.delete("/categories/{category_id}", response_model=PlaceCategoryResponse)
async def delete_place_category(
    category_id: str,
    admin_id = Depends(require_admin),
    svc: PlaceService = Depends(get_place_service)
):
    return await svc.delete_place_category(category_id)
# endregion

# region------------- place CRUD -------------------------- 

@router.post("/", response_model=PlaceResponse)
async def create_place(
    data: PlaceRequest,
    user_id = Depends(require_active_user),
    svc: PlaceService = Depends(get_place_service)
):
    """Create a new place"""
    return await svc.create_place(data, user_id)

@router.get("/{place_id}", response_model=PlaceResponse)
async def get_place_by_id(
    place_id: str,
    svc: PlaceService = Depends(get_place_service)
):
    """Get place details by ID"""
    return await svc.get_place_by_id(place_id)

@router.put("/{place_id}", response_model=PlaceResponse)
async def update_place(
    place_id: str,
    data: PlaceUpdateRequest,
    user_id = Depends(require_active_user),
    svc: PlaceService = Depends(get_place_service)
):
    """Update place information"""
    return await svc.update_place(place_id, data, user_id)

@router.delete("/{place_id}", response_model=PlaceResponse)
async def delete_place(
    place_id: str,
    user_id = Depends(require_active_user),
    svc: PlaceService = Depends(get_place_service)
):
    """Delete a place"""
    return await svc.delete_place(place_id, user_id)

@router.get("/", response_model=NearbyPlacesListResponse)
async def get_nearby_places(
    lat: float = Query(..., description="User latitude"),
    lng: float = Query(..., description="User longitude"),
    radius: float = Query(2.0, ge=0.1, le=2000, description="Search radius in km"),
    category_id: Optional[str] = Query(None, description="Filter by category ID"),
    svc: PlaceService = Depends(get_place_service)
):
    """Get nearby places using Haversine formula"""
    return await svc.get_nearby_places(lat, lng, radius, category_id)
# endregion

# region------------- place image CRUD -------------------------- 

@router.post("/{place_id}/images", response_model=list[PlaceImageResponse])
async def create_place_images(
    place_id: str,
    files: list[UploadFile] = File(...),
    user_id = Depends(require_active_user),
    svc: PlaceService = Depends(get_place_service)
):
    """Upload multiple images for a place (auth required)"""
    return await svc.create_place_images(place_id, files, user_id)

@router.get("/{place_id}/images", response_model=list[PlaceImageResponse])
async def get_place_images(
    place_id: str,
    svc: PlaceService = Depends(get_place_service)
):
    """Get all images for a place (public)"""
    return await svc.get_place_images(place_id)

@router.delete("/images/{image_id}", response_model=PlaceImageResponse)
async def delete_place_image(
    image_id: str,
    user_id = Depends(require_active_user),
    svc: PlaceService = Depends(get_place_service)
):
    """Delete a place image (auth required)"""
    return await svc.delete_place_image(image_id, user_id)
# endregion

# region ----------- place review ----------
@router.post("/{place_id}/reviews", response_model=ReviewResponse)
async def create_place_review(
    place_id: str,
    data: ReviewRequest,
    user_id = Depends(require_active_user),
    svc: PlaceService = Depends(get_place_service)
):
    """Create a review for a place (auth required)"""
    return await svc.create_place_review(place_id, user_id, data)

@router.get("/{place_id}/reviews", response_model=ReviewListResponse)
async def get_place_reviews(
    place_id: str,
    skip: int = Query(0, ge=0, description="Number of reviews to skip"),
    limit: int = Query(20, ge=1, le=100, description="Number of reviews to return"),
    svc: PlaceService = Depends(get_place_service)
):
    """Get reviews for a place"""
    return await svc.get_place_reviews(place_id, skip, limit)

@router.delete("/reviews/{review_id}")
async def delete_place_review(
    review_id: str,
    user_id = Depends(require_active_user),
    svc: PlaceService = Depends(get_place_service)
):
    """Delete user's review for a place"""
    return await svc.delete_place_review(review_id, user_id)

# endregion

# region ----------- place bookmarks ----------
@router.post("/{place_id}/bookmark", response_model=BookmarkResponse)
async def toggle_place_bookmark(
    place_id: str,
    user_id = Depends(require_active_user),
    svc: PlaceService = Depends(get_place_service)
):
    """Toggle bookmark for a place (create if not exists, delete if exists)"""
    return await svc.toggle_place_bookmark(place_id, user_id)

@router.get("/{place_id}/bookmark", response_model=BookmarkCheckResponse)
async def check_place_bookmark(
    place_id: str,
    user_id = Depends(require_active_user),
    svc: PlaceService = Depends(get_place_service)
):
    """Check if user has bookmarked a specific place"""
    return await svc.check_place_bookmark(place_id, user_id)

@router.get("/bookmarks/my", response_model=BookmarkListResponse)
async def get_user_bookmarks(
    skip: int = Query(0, ge=0, description="Number of bookmarks to skip"),
    limit: int = Query(20, ge=1, le=100, description="Number of bookmarks to return"),
    user_id = Depends(require_active_user),
    svc: PlaceService = Depends(get_place_service)
):
    """Get user's bookmarked places"""
    return await svc.get_user_bookmarks(user_id, skip, limit)

# endregion