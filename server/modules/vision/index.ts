/**
 * 视觉服务模块 (Vision Module)
 * 
 * 职责: 人脸识别、视觉验证、场景识别
 */

const visionModules = {
  avatarRecognition: () => import('../../services/avatar-recognition'),
  faceCompare: () => import('../../services/face-compare'),
  contactRecognition: () => import('../../services/contact-recognition'),
  sceneRecognition: () => import('../../services/scene-recognition'),
  visualVerification: () => import('../../services/visual-verification'),
};

export { visionModules };
