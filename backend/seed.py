"""
Seed the DataForAll database with real-world data from Hugging Face datasets.

Run inside the backend container:
    docker compose exec backend python seed.py

Or locally (with DB running):
    cd backend && python seed.py
"""

import asyncio
import uuid
import json
import random
from datetime import datetime, timedelta, timezone

import bcrypt
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession

# ──────────────────────────────────────────────────────────────────────
# Real-world mission definitions inspired by actual Hugging Face datasets
# ──────────────────────────────────────────────────────────────────────

HF_INSPIRED_MISSIONS = [
    {
        "title": "PlantVillage — Crop Disease Classification",
        "description": (
            "Build an open image-classification model that identifies plant diseases from leaf photos. "
            "Based on the PlantVillage dataset (https://huggingface.co/datasets/mikehemberger/plantvillage), "
            "this mission collects labeled images of 38 crop-disease classes across 14 species including "
            "apple, tomato, corn, grape, potato, and more. Community contributions improve geographic "
            "and lighting diversity so the model generalises beyond lab conditions."
        ),
        "reason": (
            "Plant diseases destroy up to 40% of global crops annually. "
            "Smallholder farmers in sub-Saharan Africa and South-East Asia often lack access to agronomists. "
            "A phone-based classifier can help identify problems before they spread."
        ),
        "how_to_contribute": (
            "1. Photograph diseased or healthy leaves with a phone camera.\n"
            "2. Upload the image and select the plant species from the dropdown.\n"
            "3. Annotators will label the disease class and severity.\n"
            "4. Reviewers verify accuracy before integration."
        ),
        "category": "Agriculture",
        "model_type": "vision",
        "data_type": "image",
        "target_contributions": 5000,
        "accepted_types": [".jpg", ".jpeg", ".png", ".webp"],
        "datasets": [
            {"name": "Leaf Images – Tomato", "description": "Tomato leaf samples: healthy, early blight, late blight, leaf mold, mosaic virus, septoria, spider mites, target spot, yellow leaf curl."},
            {"name": "Leaf Images – Apple", "description": "Apple leaf samples: healthy, apple scab, black rot, cedar apple rust."},
            {"name": "Leaf Images – Corn", "description": "Corn/maize leaf samples: healthy, cercospora, common rust, northern leaf blight."},
        ],
        "configured_tasks": [
            {"type": "image_classification", "configOverrides": {"labels": ["Healthy", "Early Blight", "Late Blight", "Leaf Mold", "Septoria Leaf Spot", "Mosaic Virus", "Spider Mites", "Target Spot", "Yellow Leaf Curl", "Apple Scab", "Black Rot", "Cedar Apple Rust", "Cercospora", "Common Rust", "Northern Leaf Blight"]}, "required": True},
            {"type": "quality_rating", "customTitle": "Image Quality", "customInstruction": "Rate photo clarity (1 = blurry, 5 = crisp & well-lit)", "required": True},
        ],
        "sample_files": {
            0: [  # Tomato dataset
                {"filename": "tomato_early_blight_001.jpg", "size_kb": 342, "file_type": "image/jpeg", "status": "approved"},
                {"filename": "tomato_late_blight_014.jpg", "size_kb": 278, "file_type": "image/jpeg", "status": "approved"},
                {"filename": "tomato_healthy_leaf_007.jpg", "size_kb": 410, "file_type": "image/jpeg", "status": "needs_annotation"},
                {"filename": "tomato_mosaic_virus_003.jpg", "size_kb": 295, "file_type": "image/jpeg", "status": "pending_review"},
                {"filename": "tomato_septoria_009.jpg", "size_kb": 315, "file_type": "image/jpeg", "status": "pending"},
                {"filename": "tomato_spider_mites_002.jpg", "size_kb": 388, "file_type": "image/jpeg", "status": "approved"},
                {"filename": "tomato_target_spot_011.jpg", "size_kb": 267, "file_type": "image/jpeg", "status": "needs_annotation"},
            ],
            1: [  # Apple dataset
                {"filename": "apple_scab_012.jpg", "size_kb": 456, "file_type": "image/jpeg", "status": "approved"},
                {"filename": "apple_healthy_leaf_005.jpg", "size_kb": 380, "file_type": "image/jpeg", "status": "approved"},
                {"filename": "apple_black_rot_008.jpg", "size_kb": 312, "file_type": "image/jpeg", "status": "pending_review"},
                {"filename": "apple_cedar_rust_016.jpg", "size_kb": 290, "file_type": "image/jpeg", "status": "pending"},
            ],
            2: [  # Corn dataset
                {"filename": "corn_common_rust_004.jpg", "size_kb": 425, "file_type": "image/jpeg", "status": "approved"},
                {"filename": "corn_healthy_leaf_010.jpg", "size_kb": 398, "file_type": "image/jpeg", "status": "needs_annotation"},
                {"filename": "corn_cercospora_017.jpg", "size_kb": 356, "file_type": "image/jpeg", "status": "pending"},
            ],
        },
    },
    {
        "title": "Common Voice — Low-Resource Language ASR",
        "description": (
            "Extend Mozilla Common Voice (https://huggingface.co/datasets/mozilla-foundation/common_voice_17_0) "
            "coverage for underrepresented languages. This mission focuses on collecting and validating voice "
            "clips in Yoruba, Igbo, Swahili, Hausa, Kinyarwanda, and Wolof — languages spoken by over 200 million "
            "people but severely underrepresented in speech technology."
        ),
        "reason": (
            "Voice interfaces are becoming essential for digital literacy, yet most ASR systems only "
            "work well in ~20 languages. Hundreds of millions of people are excluded from voice assistants, "
            "transcription services, and accessibility tools."
        ),
        "how_to_contribute": (
            "1. Record yourself reading prompted sentences (5–15 seconds each).\n"
            "2. Upload the audio clip with the correct transcript in the notes.\n"
            "3. Annotators verify the transcription and mark speaker accent/dialect.\n"
            "4. Reviewers approve clips that are clear and correctly transcribed."
        ),
        "category": "Language",
        "model_type": "audio",
        "data_type": "audio",
        "target_contributions": 10000,
        "accepted_types": [".wav", ".mp3", ".ogg", ".flac", ".m4a"],
        "datasets": [
            {"name": "Yoruba Voice Clips", "description": "Spoken Yoruba sentences for automatic speech recognition training and validation."},
            {"name": "Swahili Voice Clips", "description": "Spoken Swahili sentences covering diverse dialects from Kenya, Tanzania, and DRC."},
            {"name": "Hausa Voice Clips", "description": "Spoken Hausa recordings from Nigeria and Niger."},
        ],
        "configured_tasks": [
            {"type": "transcription", "customTitle": "Transcript Verification", "customInstruction": "Verify the audio matches the provided transcript. Fix any errors.", "required": True},
            {"type": "single_label", "configOverrides": {"labels": ["Yoruba", "Igbo", "Swahili", "Hausa", "Kinyarwanda", "Wolof", "Other"]}, "customTitle": "Language", "required": True},
            {"type": "quality_rating", "customTitle": "Audio Quality", "customInstruction": "Rate recording clarity (1 = very noisy, 5 = studio quality)", "required": True},
        ],
        "sample_files": {
            0: [
                {"filename": "yoruba_sentence_0451.wav", "size_kb": 890, "file_type": "audio/wav", "status": "approved"},
                {"filename": "yoruba_sentence_0452.wav", "size_kb": 1024, "file_type": "audio/wav", "status": "approved"},
                {"filename": "yoruba_sentence_0453.wav", "size_kb": 756, "file_type": "audio/wav", "status": "needs_annotation"},
                {"filename": "yoruba_sentence_0454.wav", "size_kb": 912, "file_type": "audio/wav", "status": "pending_review"},
                {"filename": "yoruba_sentence_0455.wav", "size_kb": 680, "file_type": "audio/wav", "status": "pending"},
            ],
            1: [
                {"filename": "swahili_clip_0301.wav", "size_kb": 820, "file_type": "audio/wav", "status": "approved"},
                {"filename": "swahili_clip_0302.wav", "size_kb": 945, "file_type": "audio/wav", "status": "approved"},
                {"filename": "swahili_clip_0303.wav", "size_kb": 710, "file_type": "audio/wav", "status": "needs_annotation"},
                {"filename": "swahili_clip_0304.wav", "size_kb": 865, "file_type": "audio/wav", "status": "pending"},
            ],
            2: [
                {"filename": "hausa_recording_0187.wav", "size_kb": 788, "file_type": "audio/wav", "status": "approved"},
                {"filename": "hausa_recording_0188.wav", "size_kb": 930, "file_type": "audio/wav", "status": "pending_review"},
                {"filename": "hausa_recording_0189.wav", "size_kb": 670, "file_type": "audio/wav", "status": "pending"},
            ],
        },
    },
    {
        "title": "OpenAQ — Global Air Quality Monitoring",
        "description": (
            "Aggregate and label air-quality sensor readings to train anomaly-detection and forecasting models. "
            "Inspired by OpenAQ (https://openaq.org) and the Hugging Face Air Quality dataset "
            "(https://huggingface.co/datasets/Naivedya/Air-Quality). Contributions include PM2.5, PM10, "
            "NO2, SO2, O3, and CO readings from low-cost sensors deployed in undermonitored regions."
        ),
        "reason": (
            "Air pollution causes ~7 million premature deaths annually (WHO). "
            "Low-cost sensor networks can democratize monitoring, but raw data requires calibration and QA. "
            "ML models can detect faulty sensors, fill gaps, and forecast health-risk episodes."
        ),
        "how_to_contribute": (
            "1. Export CSV or JSON readings from your sensor (PurpleAir, SDS011, etc.).\n"
            "2. Upload the file and note the sensor model, location, and time range.\n"
            "3. Annotators verify the data format and flag obvious outliers.\n"
            "4. Reviewers approve clean readings for the training corpus."
        ),
        "category": "Climate",
        "model_type": "tabular",
        "data_type": "tabular",
        "target_contributions": 3000,
        "accepted_types": [".csv", ".json", ".xlsx", ".parquet"],
        "datasets": [
            {"name": "PM2.5 Readings — Sub-Saharan Africa", "description": "Particulate matter 2.5µm sensor data from community-deployed sensors in Lagos, Nairobi, Accra, Kampala."},
            {"name": "Multi-Pollutant — South Asia", "description": "Combined PM2.5, PM10, NO2, SO2, O3 readings from Delhi, Dhaka, Karachi, Kathmandu."},
        ],
        "configured_tasks": [
            {"type": "single_label", "configOverrides": {"labels": ["Clean", "Moderate", "Unhealthy (Sensitive)", "Unhealthy", "Very Unhealthy", "Hazardous"]}, "customTitle": "AQI Category", "required": True},
            {"type": "yes_no", "customTitle": "Sensor Calibrated?", "customInstruction": "Is there evidence the sensor was recently calibrated?", "required": False},
            {"type": "free_text", "customTitle": "Notes", "customInstruction": "Any issues with the data file (gaps, obvious faults, etc.)", "required": False},
        ],
        "sample_files": {
            0: [
                {"filename": "lagos_pm25_2024_q3.csv", "size_kb": 1560, "file_type": "text/csv", "status": "approved"},
                {"filename": "nairobi_pm25_aug2024.csv", "size_kb": 2340, "file_type": "text/csv", "status": "approved"},
                {"filename": "accra_pm25_sensor12.csv", "size_kb": 980, "file_type": "text/csv", "status": "needs_annotation"},
                {"filename": "kampala_pm25_jul2024.csv", "size_kb": 1120, "file_type": "text/csv", "status": "pending"},
            ],
            1: [
                {"filename": "delhi_multi_pollutant_2024.csv", "size_kb": 4200, "file_type": "text/csv", "status": "approved"},
                {"filename": "dhaka_air_quality_oct2024.csv", "size_kb": 3100, "file_type": "text/csv", "status": "pending_review"},
                {"filename": "karachi_aq_readings.json", "size_kb": 2780, "file_type": "application/json", "status": "pending"},
            ],
        },
    },
    {
        "title": "iNaturalist — Wildlife Camera Trap Recognition",
        "description": (
            "Train an object-detection model for wildlife identification from camera trap images. "
            "Inspired by iNaturalist (https://huggingface.co/datasets/mikehemberger/iNaturalist) and "
            "Lila Science camera trap datasets. The focus is on endangered and data-scarce species: "
            "snow leopard, pangolin, red panda, saola, and forest elephant."
        ),
        "reason": (
            "Camera traps generate millions of images but manual review is a bottleneck. "
            "Automated species detection accelerates conservation monitoring, anti-poaching efforts, "
            "and population surveys for IUCN Red List species."
        ),
        "how_to_contribute": (
            "1. Upload camera trap images (day or night-vision).\n"
            "2. Draw bounding boxes around visible animals.\n"
            "3. Annotators label species, count, and activity.\n"
            "4. Reviewers verify species ID and bounding-box quality."
        ),
        "category": "Environment",
        "model_type": "vision",
        "data_type": "image",
        "target_contributions": 8000,
        "accepted_types": [".jpg", ".jpeg", ".png", ".tiff"],
        "datasets": [
            {"name": "Camera Traps — East Africa", "description": "Camera trap images from Kenya, Tanzania, and Uganda wildlife reserves. Focus on large mammals."},
            {"name": "Camera Traps — Southeast Asia", "description": "Images from camera traps in Borneo, Sumatra, and mainland SE Asia. Focus on endangered species."},
            {"name": "Camera Traps — High Altitude", "description": "Snow leopard, Himalayan wolf, and blue sheep camera trap data from Nepal and Bhutan."},
        ],
        "configured_tasks": [
            {"type": "bounding_box", "customTitle": "Animal Detection", "customInstruction": "Draw a bounding box around each visible animal.", "required": True},
            {"type": "single_label", "configOverrides": {"labels": ["Snow Leopard", "Pangolin", "Red Panda", "Forest Elephant", "Tiger", "Leopard", "Bear", "Deer/Ungulate", "Primate", "Bird", "Rodent", "Empty/No Animal", "Unknown"]}, "customTitle": "Species", "required": True},
            {"type": "quality_rating", "customTitle": "Image Usability", "customInstruction": "Rate how usable this image is for training (1=too dark/blurry, 5=excellent)", "required": False},
        ],
        "sample_files": {
            0: [
                {"filename": "KEN_serengeti_cam04_20240815_0342.jpg", "size_kb": 1890, "file_type": "image/jpeg", "status": "approved"},
                {"filename": "TZA_ngorongoro_cam11_20240901_2215.jpg", "size_kb": 2100, "file_type": "image/jpeg", "status": "approved"},
                {"filename": "UGA_bwindi_cam07_20240720_0518.jpg", "size_kb": 1450, "file_type": "image/jpeg", "status": "needs_annotation"},
                {"filename": "KEN_masai_mara_cam02_20241003_1130.jpg", "size_kb": 1780, "file_type": "image/jpeg", "status": "pending_review"},
                {"filename": "TZA_ruaha_cam15_20240612_0845.jpg", "size_kb": 1320, "file_type": "image/jpeg", "status": "pending"},
            ],
            1: [
                {"filename": "IDN_borneo_cam22_20240503_0130.jpg", "size_kb": 2300, "file_type": "image/jpeg", "status": "approved"},
                {"filename": "MYS_taman_negara_cam08_20240917_1845.jpg", "size_kb": 1950, "file_type": "image/jpeg", "status": "needs_annotation"},
                {"filename": "VNM_cat_tien_cam05_20241020_0622.jpg", "size_kb": 1670, "file_type": "image/jpeg", "status": "pending"},
            ],
            2: [
                {"filename": "NPL_annapurna_cam14_20240115_0415.jpg", "size_kb": 2450, "file_type": "image/jpeg", "status": "approved"},
                {"filename": "BTN_jigme_cam09_20240228_2330.jpg", "size_kb": 1890, "file_type": "image/jpeg", "status": "approved"},
                {"filename": "NPL_langtang_cam03_20240801_0550.jpg", "size_kb": 2150, "file_type": "image/jpeg", "status": "pending_review"},
            ],
        },
    },
    {
        "title": "Lacuna Fund — African Language NLP Benchmark",
        "description": (
            "Curate parallel text corpora for African language NLP. "
            "Based on the Lacuna Fund initiative and datasets like MasakhaNER "
            "(https://huggingface.co/datasets/masakhane/masakhaner2), AfriSenti "
            "(https://huggingface.co/datasets/masakhane/afrisenti), and FLORES-200. "
            "Contributions include named entity annotations, sentiment labels, and "
            "translation pairs for 20+ African languages."
        ),
        "reason": (
            "African languages represent over 2,000 of the world's ~7,000 languages "
            "but receive < 1% of NLP research investment. Benchmark datasets are critical "
            "for developing fair, multilingual AI systems."
        ),
        "how_to_contribute": (
            "1. Submit text samples in any African language (news articles, social media, literature).\n"
            "2. Annotators label named entities (person, location, organisation, date).\n"
            "3. Additional annotators provide sentiment labels (positive/negative/neutral).\n"
            "4. Reviewers verify label quality and language identification."
        ),
        "category": "Language",
        "model_type": "text",
        "data_type": "text",
        "target_contributions": 15000,
        "accepted_types": [".txt", ".csv", ".json", ".tsv"],
        "datasets": [
            {"name": "MasakhaNER — Named Entity Recognition", "description": "NER-annotated sentences across Amharic, Hausa, Igbo, Kinyarwanda, Luganda, Luo, Nigerian Pidgin, Swahili, Wolof, and Yoruba."},
            {"name": "AfriSenti — Sentiment Analysis", "description": "Sentiment-labeled tweets and social media posts in 14 African languages."},
            {"name": "Translation Pairs — EN↔African", "description": "English-to-African-language parallel sentences for machine translation benchmarking."},
        ],
        "configured_tasks": [
            {"type": "named_entity", "customTitle": "Named Entities", "customInstruction": "Tag all named entities: PERSON, LOCATION, ORGANISATION, DATE", "required": True},
            {"type": "single_label", "configOverrides": {"labels": ["Positive", "Negative", "Neutral", "Mixed"]}, "customTitle": "Sentiment", "required": False},
            {"type": "single_label", "configOverrides": {"labels": ["Amharic", "Hausa", "Igbo", "Kinyarwanda", "Luganda", "Luo", "Nigerian Pidgin", "Swahili", "Wolof", "Yoruba", "Zulu", "Xhosa", "Somali", "Twi", "Other"]}, "customTitle": "Language", "required": True},
        ],
        "sample_files": {
            0: [
                {"filename": "masakhaner_hausa_batch_01.json", "size_kb": 245, "file_type": "application/json", "status": "approved"},
                {"filename": "masakhaner_yoruba_batch_01.json", "size_kb": 198, "file_type": "application/json", "status": "approved"},
                {"filename": "masakhaner_swahili_batch_03.json", "size_kb": 312, "file_type": "application/json", "status": "approved"},
                {"filename": "masakhaner_igbo_batch_02.json", "size_kb": 176, "file_type": "application/json", "status": "needs_annotation"},
                {"filename": "masakhaner_amharic_batch_01.json", "size_kb": 287, "file_type": "application/json", "status": "pending"},
            ],
            1: [
                {"filename": "afrisenti_pidgin_tweets_500.csv", "size_kb": 89, "file_type": "text/csv", "status": "approved"},
                {"filename": "afrisenti_swahili_tweets_500.csv", "size_kb": 102, "file_type": "text/csv", "status": "approved"},
                {"filename": "afrisenti_hausa_tweets_500.csv", "size_kb": 95, "file_type": "text/csv", "status": "pending_review"},
                {"filename": "afrisenti_yoruba_tweets_500.csv", "size_kb": 78, "file_type": "text/csv", "status": "pending"},
            ],
            2: [
                {"filename": "flores200_en_swahili_dev.tsv", "size_kb": 156, "file_type": "text/tsv", "status": "approved"},
                {"filename": "flores200_en_hausa_dev.tsv", "size_kb": 148, "file_type": "text/tsv", "status": "needs_annotation"},
                {"filename": "flores200_en_yoruba_dev.tsv", "size_kb": 162, "file_type": "text/tsv", "status": "pending"},
            ],
        },
    },
    {
        "title": "Mapillary — Water Source Detection for WASH",
        "description": (
            "Collect and label satellite & street-level images of water sources for WASH "
            "(Water, Sanitation, and Hygiene) mapping. Inspired by Mapillary Street-Level "
            "Sequences and Sentinel-2 satellite imagery available on Hugging Face "
            "(https://huggingface.co/datasets/jonathan-roberts1/Satellite-Photo-of-a-Desert). "
            "Targets: boreholes, hand pumps, open wells, protected springs, piped water, and surface water."
        ),
        "reason": (
            "2.2 billion people lack safely managed drinking water (WHO/UNICEF JMP). "
            "Mapping existing water sources helps NGOs plan infrastructure investment "
            "and disaster-response logistics."
        ),
        "how_to_contribute": (
            "1. Upload geotagged photos of water sources (boreholes, wells, taps, rivers).\n"
            "2. Include GPS coordinates in EXIF data or in the notes field.\n"
            "3. Annotators classify water source type and assess infrastructure condition.\n"
            "4. Reviewers verify location accuracy and label consistency."
        ),
        "category": "Health",
        "model_type": "multimodal",
        "data_type": "image",
        "target_contributions": 6000,
        "accepted_types": [".jpg", ".jpeg", ".png", ".tiff", ".geojson"],
        "datasets": [
            {"name": "Water Points — East Africa", "description": "Photos of water points across Kenya, Uganda, Tanzania, Rwanda. Mix of satellite and street-level imagery."},
            {"name": "Water Points — West Africa", "description": "Water source imagery from Nigeria, Ghana, Senegal, Mali. Includes borehole and hand pump documentation."},
        ],
        "configured_tasks": [
            {"type": "single_label", "configOverrides": {"labels": ["Borehole", "Hand Pump", "Open Well", "Protected Spring", "Piped Water", "Surface Water (river/lake)", "Rainwater Harvesting", "Non-functional", "Unknown"]}, "customTitle": "Water Source Type", "required": True},
            {"type": "single_label", "configOverrides": {"labels": ["Functional", "Partially functional", "Non-functional", "Under construction", "Unknown"]}, "customTitle": "Infrastructure Condition", "required": True},
            {"type": "free_text", "customTitle": "GPS Coordinates", "customInstruction": "Enter lat,lon if not embedded in EXIF (e.g. -1.2921,36.8219)", "required": False},
        ],
        "sample_files": {
            0: [
                {"filename": "KEN_borehole_nakuru_001.jpg", "size_kb": 1450, "file_type": "image/jpeg", "status": "approved"},
                {"filename": "UGA_handpump_gulu_014.jpg", "size_kb": 1230, "file_type": "image/jpeg", "status": "approved"},
                {"filename": "TZA_open_well_dodoma_008.jpg", "size_kb": 980, "file_type": "image/jpeg", "status": "needs_annotation"},
                {"filename": "RWA_spring_musanze_003.jpg", "size_kb": 1100, "file_type": "image/jpeg", "status": "pending_review"},
                {"filename": "KEN_piped_mombasa_022.jpg", "size_kb": 1350, "file_type": "image/jpeg", "status": "pending"},
            ],
            1: [
                {"filename": "NGA_borehole_abuja_005.jpg", "size_kb": 1680, "file_type": "image/jpeg", "status": "approved"},
                {"filename": "GHA_handpump_tamale_011.jpg", "size_kb": 1190, "file_type": "image/jpeg", "status": "approved"},
                {"filename": "SEN_surface_water_dakar_019.jpg", "size_kb": 1540, "file_type": "image/jpeg", "status": "needs_annotation"},
                {"filename": "MLI_well_bamako_007.jpg", "size_kb": 1070, "file_type": "image/jpeg", "status": "pending"},
            ],
        },
    },
]

# Real-ish user data — diverse names, realistic contribution stats
SEED_USERS = [
    {"name": "Amara Osei", "email": "amara@dataforall.org", "password": "password123", "approved": 127, "total": 145, "annotations": 89, "reviews": 56},
    {"name": "Priya Sharma", "email": "priya@dataforall.org", "password": "password123", "approved": 98, "total": 112, "annotations": 201, "reviews": 34},
    {"name": "José García", "email": "jose@dataforall.org", "password": "password123", "approved": 76, "total": 88, "annotations": 45, "reviews": 112},
    {"name": "Fatima Al-Rashid", "email": "fatima@dataforall.org", "password": "password123", "approved": 234, "total": 260, "annotations": 156, "reviews": 88},
    {"name": "Chen Wei", "email": "chen@dataforall.org", "password": "password123", "approved": 189, "total": 210, "annotations": 67, "reviews": 145},
    {"name": "Oluwaseun Adeyemi", "email": "seun@dataforall.org", "password": "password123", "approved": 312, "total": 340, "annotations": 278, "reviews": 195},
    {"name": "Maria Santos", "email": "maria@dataforall.org", "password": "password123", "approved": 45, "total": 58, "annotations": 134, "reviews": 23},
    {"name": "Kwame Mensah", "email": "kwame@dataforall.org", "password": "password123", "approved": 67, "total": 79, "annotations": 312, "reviews": 67},
    {"name": "Aisha Hassan", "email": "aisha@dataforall.org", "password": "password123", "approved": 156, "total": 178, "annotations": 95, "reviews": 201},
    {"name": "Raj Patel", "email": "raj@dataforall.org", "password": "password123", "approved": 89, "total": 105, "annotations": 178, "reviews": 45},
    # Demo user for easy testing
    {"name": "Demo User", "email": "demo@dataforall.org", "password": "demo123", "approved": 23, "total": 30, "annotations": 15, "reviews": 8},
]


def get_badge(approved: int) -> str:
    if approved >= 500:
        return "🏆 Legend"
    if approved >= 200:
        return "💎 Diamond"
    if approved >= 100:
        return "🥇 Gold"
    if approved >= 50:
        return "🥈 Silver"
    if approved >= 20:
        return "🥉 Bronze"
    if approved >= 5:
        return "⭐ Starter"
    return "🌱 New"


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


# ──────────────────────────────────────────────────────────────────────
# Database URL — use the same as Docker Compose 'backend' service
# ──────────────────────────────────────────────────────────────────────
import os

DB_URL = os.environ.get(
    "DATABASE_URL",
    "postgresql+asyncpg://dataforall:dataforall@db:5432/dataforall",
)


def _past(days_ago: int) -> datetime:
    """Return a UTC datetime `days_ago` days in the past."""
    return datetime.now(timezone.utc) - timedelta(days=days_ago)


async def seed():
    engine = create_async_engine(DB_URL, echo=False)
    Session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with Session() as db:
        # ── Check if already seeded ──────────────────────────────────
        result = await db.execute(text("SELECT COUNT(*) FROM users"))
        user_count = result.scalar()
        if user_count and user_count > 0:
            print(f"Database already has {user_count} users. Clearing tables for re-seed...")
            # Delete in dependency order
            await db.execute(text("DELETE FROM file_annotations"))
            await db.execute(text("DELETE FROM data_files"))
            await db.execute(text("DELETE FROM datasets"))
            await db.execute(text("DELETE FROM mission_members"))
            await db.execute(text("DELETE FROM curation_actions"))
            await db.execute(text("DELETE FROM contributions"))
            await db.execute(text("DELETE FROM ai_models"))
            await db.execute(text("DELETE FROM training_jobs"))
            await db.execute(text("DELETE FROM missions"))
            await db.execute(text("DELETE FROM users"))
            await db.commit()
            print("Tables cleared.")

        # ── 1. Create users ──────────────────────────────────────────
        print("Creating users...")
        user_ids = []
        user_map = {}  # email -> uuid

        for i, u_data in enumerate(SEED_USERS):
            uid = uuid.uuid4()
            user_ids.append(uid)
            user_map[u_data["email"]] = uid
            badge = get_badge(u_data["approved"])
            rank = i + 1

            await db.execute(text("""
                INSERT INTO users (id, name, email, password_hash, avatar,
                    approved_contributions, total_contributions, annotations, reviews,
                    rank, badge, created_at, updated_at)
                VALUES (:id, :name, :email, :password_hash, :avatar,
                    :approved, :total, :annotations, :reviews,
                    :rank, :badge, :created_at, NOW())
            """).bindparams(
                id=uid,
                name=u_data["name"],
                email=u_data["email"],
                password_hash=hash_password(u_data["password"]),
                avatar=f"https://api.dicebear.com/7.x/initials/svg?seed={u_data['name']}",
                approved=u_data["approved"],
                total=u_data["total"],
                annotations=u_data["annotations"],
                reviews=u_data["reviews"],
                rank=rank,
                badge=badge,
                created_at=_past(random.randint(30, 365)),
            ))

        await db.commit()
        print(f"  Created {len(user_ids)} users")

        # ── 2. Create missions ───────────────────────────────────────
        print("Creating missions...")
        mission_ids = []
        dataset_map = {}  # mission_index -> [dataset_uuids]

        for mi, m_data in enumerate(HF_INSPIRED_MISSIONS):
            mid = uuid.uuid4()
            mission_ids.append(mid)
            dataset_map[mi] = []

            owner_id = user_ids[mi % len(user_ids)]
            owner_name = SEED_USERS[mi % len(SEED_USERS)]["name"]

            # Compute current_contributions from sample files
            total_files = sum(len(files) for files in m_data["sample_files"].values())

            await db.execute(text("""
                INSERT INTO missions (id, title, description, reason, how_to_contribute,
                    category, model_type, data_type, status, goal_count,
                    current_contributions, owner_id, owner_name, accepted_types,
                    model_available, configured_tasks, created_at, updated_at)
                VALUES (:id, :title, :description, :reason, :how_to_contribute,
                    :category, :model_type, CAST(:data_type AS data_type), CAST(:status AS mission_status), :goal_count,
                    :current_contributions, :owner_id, :owner_name, :accepted_types,
                    :model_available, CAST(:configured_tasks AS jsonb), :created_at, NOW())
            """).bindparams(
                id=mid,
                title=m_data["title"],
                description=m_data["description"],
                reason=m_data["reason"],
                how_to_contribute=m_data["how_to_contribute"],
                category=m_data["category"],
                model_type=m_data["model_type"],
                data_type=m_data["data_type"].upper(),
                status="ACTIVE",
                goal_count=m_data["target_contributions"],
                current_contributions=total_files,
                owner_id=owner_id,
                owner_name=owner_name,
                accepted_types=m_data["accepted_types"],
                model_available=(mi < 2),  # First two missions have models
                configured_tasks=json.dumps(m_data["configured_tasks"]),
                created_at=_past(random.randint(14, 180)),
            ))

            # ── 2a. Create datasets for this mission ─────────────────
            for di, ds_data in enumerate(m_data["datasets"]):
                did = uuid.uuid4()
                dataset_map[mi].append(did)
                sample_files_for_ds = m_data["sample_files"].get(di, [])
                file_count = len(sample_files_for_ds)
                total_size_mb = round(sum(f["size_kb"] for f in sample_files_for_ds) / 1024, 2)

                await db.execute(text("""
                    INSERT INTO datasets (id, mission_id, name, description,
                        file_count, total_size_mb, accepted_types, created_at, updated_at)
                    VALUES (:id, :mission_id, :name, :description,
                        :file_count, :total_size_mb, :accepted_types, :created_at, NOW())
                """).bindparams(
                    id=did,
                    mission_id=mid,
                    name=ds_data["name"],
                    description=ds_data["description"],
                    file_count=file_count,
                    total_size_mb=total_size_mb,
                    accepted_types=m_data["accepted_types"],
                    created_at=_past(random.randint(7, 120)),
                ))

            await db.flush()

        await db.commit()
        print(f"  Created {len(mission_ids)} missions with {sum(len(v) for v in dataset_map.values())} datasets")

        # ── 3. Create mission members ────────────────────────────────
        print("Creating mission members...")
        member_count = 0

        for mi, mid in enumerate(mission_ids):
            # Mission owner is always a contributor
            owner_idx = mi % len(user_ids)
            roles = ["CONTRIBUTOR", "ANNOTATOR", "REVIEWER"]

            await db.execute(text("""
                INSERT INTO mission_members (id, mission_id, user_id, role, approved_count, total_count, created_at, updated_at)
                VALUES (:id, :mission_id, :user_id, CAST(:role AS member_role), :approved, :total, :created_at, NOW())
            """).bindparams(
                id=uuid.uuid4(),
                mission_id=mid,
                user_id=user_ids[owner_idx],
                role="REVIEWER",
                approved=random.randint(5, 30),
                total=random.randint(10, 50),
                created_at=_past(random.randint(7, 90)),
            ))
            member_count += 1

            # Add 3-6 other members per mission
            other_indices = [i for i in range(len(user_ids)) if i != owner_idx]
            member_indices = random.sample(other_indices, min(random.randint(3, 6), len(other_indices)))

            for ui in member_indices:
                role = random.choice(roles)
                await db.execute(text("""
                    INSERT INTO mission_members (id, mission_id, user_id, role, approved_count, total_count, created_at, updated_at)
                    VALUES (:id, :mission_id, :user_id, CAST(:role AS member_role), :approved, :total, :created_at, NOW())
                """).bindparams(
                    id=uuid.uuid4(),
                    mission_id=mid,
                    user_id=user_ids[ui],
                    role=role,
                    approved=random.randint(0, 20),
                    total=random.randint(5, 40),
                    created_at=_past(random.randint(7, 90)),
                ))
                member_count += 1

        await db.commit()
        print(f"  Created {member_count} mission memberships")

        # ── 4. Create data files ─────────────────────────────────────
        print("Creating data files...")
        file_count = 0
        file_ids_by_status = {"APPROVED": [], "NEEDS_ANNOTATION": [], "PENDING_REVIEW": [], "PENDING": []}

        for mi, m_data in enumerate(HF_INSPIRED_MISSIONS):
            mid = mission_ids[mi]

            for di, files_list in m_data["sample_files"].items():
                did = dataset_map[mi][di]

                for f_data in files_list:
                    fid = uuid.uuid4()
                    contributor_idx = random.randint(0, len(user_ids) - 1)
                    status = f_data["status"].upper()

                    await db.execute(text("""
                        INSERT INTO data_files (id, dataset_id, filename, size_kb, file_type,
                            status, contributor_id, contributor_name, created_at, updated_at)
                        VALUES (:id, :dataset_id, :filename, :size_kb, :file_type,
                            CAST(:status AS file_status), :contributor_id, :contributor_name,
                            :created_at, NOW())
                    """).bindparams(
                        id=fid,
                        dataset_id=did,
                        filename=f_data["filename"],
                        size_kb=f_data["size_kb"],
                        file_type=f_data["file_type"],
                        status=status,
                        contributor_id=user_ids[contributor_idx],
                        contributor_name=SEED_USERS[contributor_idx]["name"],
                        created_at=_past(random.randint(1, 60)),
                    ))

                    file_ids_by_status.setdefault(status, []).append(fid)
                    file_count += 1

        await db.commit()
        print(f"  Created {file_count} data files")

        # ── 5. Create annotations for approved & pending_review files
        print("Creating annotations...")
        annotation_count = 0

        for status_key in ["APPROVED", "PENDING_REVIEW"]:
            for fid in file_ids_by_status.get(status_key, []):
                annotator_idx = random.randint(0, len(user_ids) - 1)
                labels = ["Healthy", "Diseased", "Moderate", "Severe", "Good Quality",
                          "Verified", "Correct Transcription", "Clean Data", "Functional"]
                label = random.choice(labels)

                await db.execute(text("""
                    INSERT INTO file_annotations (id, data_file_id, annotator_id, annotator_name,
                        label, notes, created_at, updated_at)
                    VALUES (:id, :data_file_id, :annotator_id, :annotator_name,
                        :label, :notes, :created_at, NOW())
                """).bindparams(
                    id=uuid.uuid4(),
                    data_file_id=fid,
                    annotator_id=user_ids[annotator_idx],
                    annotator_name=SEED_USERS[annotator_idx]["name"],
                    label=label,
                    notes=random.choice([
                        "Looks good, clear sample.",
                        "Verified against ground truth.",
                        "Quality meets threshold.",
                        "Minor noise but usable.",
                        "",
                    ]),
                    created_at=_past(random.randint(0, 30)),
                ))
                annotation_count += 1

        await db.commit()
        print(f"  Created {annotation_count} annotations")

        # ── 6. Create AI models for first 2 missions ─────────────────
        print("Creating AI models...")
        model_data = [
            {"mission_idx": 0, "name": "PlantVillage-ResNet50-v1", "status": "COMPLETED", "accuracy": 0.924, "epochs": 25, "total_epochs": 25},
            {"mission_idx": 0, "name": "PlantVillage-EfficientNet-v2", "status": "TRAINING", "accuracy": 0.891, "epochs": 12, "total_epochs": 30},
            {"mission_idx": 1, "name": "CommonVoice-Whisper-Yoruba-v1", "status": "COMPLETED", "accuracy": 0.847, "epochs": 20, "total_epochs": 20},
            {"mission_idx": 1, "name": "CommonVoice-wav2vec2-Swahili-v1", "status": "TRAINING", "accuracy": 0.782, "epochs": 8, "total_epochs": 15},
            {"mission_idx": 3, "name": "CameraTrap-YOLOv8-v1", "status": "COMPLETED", "accuracy": 0.912, "epochs": 50, "total_epochs": 50},
            {"mission_idx": 4, "name": "MasakhaBERT-NER-v1", "status": "TRAINING", "accuracy": 0.856, "epochs": 5, "total_epochs": 10},
        ]

        for md in model_data:
            await db.execute(text("""
                INSERT INTO ai_models (id, mission_id, name, status, accuracy,
                    epochs_completed, total_epochs, created_at, updated_at)
                VALUES (:id, :mission_id, :name, CAST(:status AS model_status), :accuracy,
                    :epochs, :total_epochs, :created_at, NOW())
            """).bindparams(
                id=uuid.uuid4(),
                mission_id=mission_ids[md["mission_idx"]],
                name=md["name"],
                status=md["status"],
                accuracy=md["accuracy"],
                epochs=md["epochs"],
                total_epochs=md["total_epochs"],
                created_at=_past(random.randint(1, 30)),
            ))

        await db.commit()
        print(f"  Created {len(model_data)} AI models")

        # ── 7. Re-rank users by score ────────────────────────────────
        print("Updating user ranks...")
        result = await db.execute(text("""
            WITH ranked AS (
                SELECT id,
                    (approved_contributions * 3 + annotations * 2 + reviews) as score,
                    ROW_NUMBER() OVER (ORDER BY (approved_contributions * 3 + annotations * 2 + reviews) DESC) as rank
                FROM users
            )
            UPDATE users SET rank = ranked.rank
            FROM ranked WHERE users.id = ranked.id
        """))
        await db.commit()
        print("  Ranks updated")

    await engine.dispose()

    print("\n" + "=" * 60)
    print("SEED COMPLETE!")
    print("=" * 60)
    print(f"  Users:       {len(SEED_USERS)}")
    print(f"  Missions:    {len(HF_INSPIRED_MISSIONS)}")
    print(f"  Datasets:    {sum(len(m['datasets']) for m in HF_INSPIRED_MISSIONS)}")
    print(f"  Data Files:  {file_count}")
    print(f"  Annotations: {annotation_count}")
    print(f"  AI Models:   {len(model_data)}")
    print()
    print("Demo login:  demo@dataforall.org / demo123")
    print("Admin login: seun@dataforall.org / password123")
    print("=" * 60)


if __name__ == "__main__":
    asyncio.run(seed())
