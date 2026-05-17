import logging
from app.modules.notification.schemas import CreateNotificationRequest, NotificationMetadata

logger = logging.getLogger(__name__)

async def send_note_reminder(user_id: str, note_id: str, title: str, notification_svc, repo):
    """
    Background task to send a notification reminder for a study note.
    """
    try:
        if repo:
            note = await repo.get_study_note_by_id(note_id)
            if not note:
                logger.info(f"Note {note_id} was deleted or does not exist. Skipping reminder.")
                return

        logger.info(f"Sending reminder for note {note_id} to user {user_id}")
        await notification_svc.create_notification(CreateNotificationRequest(
            user_id=user_id,
            type="study_note_reminder",
            title="Lắc tay vào học thôi!",
            content=f"Đã đến giờ nhắc nhở cho: {title}",
            metadata=NotificationMetadata(reference_id=note_id, reference_type="study_note")
        ))
        
        # Mark as reminded in database
        if repo:
            await repo.mark_note_reminded(note_id)
            
    except Exception as e:
        logger.error(f"Error sending note reminder: {e}")
