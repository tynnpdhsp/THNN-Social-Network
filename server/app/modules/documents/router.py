from fastapi import APIRouter, UploadFile, File, Form, Query # type: ignore
from app.modules.documents.schema import (
    DocumentCategoryResponse, DocumentCategoryRequest, DocumentCreate, DocumentUpdate, DocumentResponse, 
    DocumentListQuery, DocumentListResponse, DocumentPaginationRequest, ReviewCreate, ReviewResponse, ReviewListResponse)
from app.modules.documents.service import DocumentService
from app.core.dependencies import Depends, get_document_service, require_admin, require_active_user

router = APIRouter(prefix="/documents", tags=["Document"])

# region------------- category -------------------------- 

@router.post("/categories", response_model=DocumentCategoryResponse)
async def create_document_category(
    data: DocumentCategoryRequest,
    admin_id = Depends(require_admin),
    svc: DocumentService = Depends(get_document_service)
):
    return await svc.create_document_category(data)

@router.get("/categories", response_model=list[DocumentCategoryResponse])
async def get_all_category(svc: DocumentService =Depends(get_document_service)):
    return await svc.get_all_category()

@router.put("/categories/{category_id}", response_model=DocumentCategoryResponse)
async def update_document_category(
    category_id: str,
    data: DocumentCategoryRequest,
    admin_id = Depends(require_admin),
    svc: DocumentService = Depends(get_document_service)
):
    return await svc.update_document_category(category_id, data)

@router.delete("/categories/{category_id}", response_model=DocumentCategoryResponse)
async def delete_document_category(
    category_id: str,
    admin_id = Depends(require_admin),
    svc: DocumentService = Depends(get_document_service)
):
    return await svc.delete_document_category(category_id)
# endregion

# region -------------- document -------------------

@router.post("/", response_model=DocumentResponse)
async def upload_document(
    file: UploadFile = File(...),
    title: str = Form(...),
    description: str = Form(None),
    category_id: str = Form(None),
    user_id = Depends(require_active_user),
    svc: DocumentService = Depends(get_document_service)
):
    """Upload a new document"""
    # Validate file
    if not file.filename:
        raise ValueError("No file provided")
    
    # Read file content
    file_content = await file.read()
    
    # Create document data
    document_data = DocumentCreate(
        title=title,
        description=description,
        category_id=category_id
    )
    
    # Upload document
    return await svc.upload_document(
        data=document_data,
        file_content=file_content,
        filename=file.filename,
        user_id=user_id
    )

@router.get("/", response_model=DocumentListResponse)
async def get_documents(
    skip: int = Query(0, ge=0, description="Number of items to skip"),
    limit: int = Query(20, ge=1, le=100, description="Number of items to return"),
    sort: str = Query("newest", description="Sort order: rating, popular, newest, oldest"),
    category_id: str = Query(None, description="Filter by category"),
    search: str = Query(None, description="Search in title and description"),
    svc: DocumentService = Depends(get_document_service)
):
    """Get documents with pagination, sorting and filtering"""
    query = DocumentListQuery(
        skip=skip,
        limit=limit,
        sort=sort,
        category_id=category_id,
        search=search
    )
    
    return await svc.get_documents(query)

@router.get("/{document_id}", response_model=DocumentResponse)
async def get_document_by_id(
    document_id: str,
    user_id: str = Depends(require_active_user),
    svc: DocumentService = Depends(get_document_service)
):
    return await svc.get_document_by_id(document_id)

@router.get("/my-document", response_model=DocumentListResponse)
async def get_my_documents(
    user_id: str = Depends(require_active_user),
    skip: int = Query(0, ge=0, description="Number of items to skip"),
    limit: int = Query(20, ge=1, le=100, description="Number of items to return"),
    svc: DocumentService = Depends(get_document_service)
):
    return await svc.get_my_documents(user_id, DocumentPaginationRequest(skip=skip, limit=limit))

@router.put("/{document_id}", response_model=DocumentResponse)
async def update_document(
    document_id: str,
    data: DocumentUpdate,
    user_id = Depends(require_active_user),
    svc: DocumentService = Depends(get_document_service)
):
    """Update a document by ID"""
    return await svc.update_document(document_id, data, user_id)

@router.delete("/{document_id}", response_model=DocumentResponse)
async def delete_document(
    document_id: str,
    user_id = Depends(require_active_user),
    svc: DocumentService = Depends(get_document_service)
):
    """Delete a document by ID"""
    return await svc.delete_document(document_id, user_id)
# endregion

# region ------------ reviews -------------------

@router.post("/{document_id}/reviews", response_model=ReviewResponse)
async def create_document_review(
    document_id: str,
    data: ReviewCreate,
    user_id = Depends(require_active_user),
    svc: DocumentService = Depends(get_document_service)
):
    """Create or update review for document"""
    return await svc.create_document_review(document_id, user_id, data)

@router.get("/{document_id}/reviews", response_model=ReviewListResponse)
async def get_document_reviews(
    document_id: str,
    skip: int = Query(0, ge=0, description="Number of reviews to skip"),
    limit: int = Query(20, ge=1, le=100, description="Number of reviews to return"),
    svc: DocumentService = Depends(get_document_service)
):
    """Get reviews for a document"""
    return await svc.get_document_reviews(document_id, skip, limit)

@router.delete("/reviews/{review_id}")
async def delete_document_review(
    review_id: str,
    user_id = Depends(require_active_user),
    svc: DocumentService = Depends(get_document_service)
):
    """Delete user's review for a document"""
    return await svc.delete_document_review(review_id, user_id)

# endregion