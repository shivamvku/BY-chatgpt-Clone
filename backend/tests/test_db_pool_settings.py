import pytest
from pydantic import ValidationError

from app.core.config import Settings


def test_database_pool_settings_keep_legacy_defaults():
    settings = Settings()
    assert settings.db_pool_size == 5
    assert settings.db_max_overflow == 5
    assert settings.db_pool_timeout == 5


def test_database_pool_settings_can_be_tuned_with_bounds():
    settings = Settings(db_pool_size=2, db_max_overflow=1, db_pool_timeout=8)
    assert (settings.db_pool_size, settings.db_max_overflow, settings.db_pool_timeout) == (2, 1, 8)

    with pytest.raises(ValidationError):
        Settings(db_pool_size=0)
    with pytest.raises(ValidationError):
        Settings(db_max_overflow=-1)
