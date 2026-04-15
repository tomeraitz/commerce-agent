from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}
    openai_api_key: str = ""
    dummyjson_base_url: str = "https://dummyjson.com"
    model_nano: str = "gpt-5.4-nano"
    model_mini: str = "gpt-5.4-mini"
    log_level: str = "INFO"
    cors_allow_origins: list[str] = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ]


settings = Settings()
