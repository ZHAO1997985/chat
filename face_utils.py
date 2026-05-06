# 人脸识别工具模块
"""
使用 OpenCV 进行人脸检测和识别
"""

import json
import numpy as np
import cv2
import base64
import io
import os
from PIL import Image


def encode_face(face_encoding):
    """将人脸编码转换为可存储的字符串"""
    if face_encoding is None:
        return None
    return json.dumps(face_encoding.tolist())


def decode_face(face_json):
    """从存储的字符串恢复人脸编码"""
    if not face_json:
        return None
    return np.array(json.loads(face_json))


def compare_faces(known_encoding, face_to_check, tolerance=0.6):
    """比较两个人脸编码是否匹配"""
    if known_encoding is None or face_to_check is None:
        return False
    distance = np.linalg.norm(known_encoding - face_to_check)
    return distance <= tolerance


def get_face_cascade():
    """获取人脸级联分类器"""
    # 使用相对路径，避免中文路径问题
    local_path = 'static/models/haarcascade_frontalface_default.xml'

    cascade = cv2.CascadeClassifier(local_path)

    if not cascade.empty():
        return cascade

    return None


def detect_face_haar(image_array):
    """
    使用 Haar 级联分类器检测人脸

    返回: (是否检测到, 人脸区域, 人脸图片)
    """
    face_cascade = get_face_cascade()

    if face_cascade is None or face_cascade.empty():
        raise RuntimeError("人脸分类器文件加载失败，请检查OpenCV安装")

    # 转换为灰度图
    gray = cv2.cvtColor(image_array, cv2.COLOR_RGB2GRAY)

    # 检测人脸
    faces = face_cascade.detectMultiScale(
        gray,
        scaleFactor=1.1,
        minNeighbors=5,
        minSize=(30, 30)
    )

    if len(faces) == 0:
        return False, None, None

    if len(faces) > 1:
        return False, None, None  # 多个人脸

    # 获取人脸区域
    x, y, w, h = faces[0]
    face_region = image_array[y:y+h, x:x+w]

    return True, (x, y, w, h), face_region


def extract_face_encoding(image_array):
    """
    提取人脸特征编码
    使用改进的特征提取方法，更鲁棒
    """
    detected, face_box, face_img = detect_face_haar(image_array)

    if not detected:
        return None

    # 调整大小为更大的统一尺寸，保留更多细节
    face_resized = cv2.resize(face_img, (128, 128))

    # 转换为灰度
    face_gray = cv2.cvtColor(face_resized, cv2.COLOR_RGB2GRAY)

    # 应用直方图均衡化，减少光照影响
    face_equalized = cv2.equalizeHist(face_gray)

    # 归一化
    face_normalized = face_equalized.astype(np.float32) / 255.0

    # 返回展平的特征向量
    return face_normalized.flatten()


def verify_face(stored_encoding, image_array, tolerance=1.5):
    """
    验证人脸是否匹配

    主要基于余弦相似度进行判断，距离作为辅助参考
    """
    current_encoding = extract_face_encoding(image_array)

    if current_encoding is None:
        return False, "未检测到人脸"

    stored = decode_face(stored_encoding)
    if stored is None:
        return False, "未找到存储的人脸特征"

    # 计算欧氏距离
    distance = np.linalg.norm(stored - current_encoding)

    # 计算余弦相似度
    dot_product = np.dot(stored, current_encoding)
    norm_stored = np.linalg.norm(stored)
    norm_current = np.linalg.norm(current_encoding)

    if norm_stored == 0 or norm_current == 0:
        return False, "人脸特征无效"

    cosine_similarity = dot_product / (norm_stored * norm_current)

    # 主要基于余弦相似度判断：相似度 >= 0.93 即认为匹配
    # 余弦相似度对光照、角度等因素更鲁棒
    if cosine_similarity >= 0.93:
        return True, f"验证成功 (距离: {distance:.2f}, 相似度: {cosine_similarity:.2f})"

    return False, f"人脸不匹配 (距离: {distance:.2f}, 相似度: {cosine_similarity:.2f})"


def pil_to_cv2(pil_image):
    """将PIL图像转换为OpenCV格式"""
    return cv2.cvtColor(np.array(pil_image), cv2.COLOR_RGB2BGR)


def cv2_to_pil(cv2_image):
    """将OpenCV图像转换为PIL格式"""
    return Image.fromarray(cv2.cvtColor(cv2_image, cv2.COLOR_BGR2RGB))