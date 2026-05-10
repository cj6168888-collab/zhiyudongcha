/**
 * Form Validation Hook
 *
 * Provides form validation with schema support,
 * async validation, and error handling.
 */

import { useState, useCallback, useMemo, useRef } from 'react';
import { createServiceLogger } from '../lib/logger';

const logger = createServiceLogger('useFormValidation');

export type ValidationRule<T> = {
  required?: boolean | string;
  minLength?: { value: number; message: string };
  maxLength?: { value: number; message: string };
  min?: { value: number | Date; message: string };
  max?: { value: number | Date; message: string };
  pattern?: { value: RegExp; message: string };
  custom?: { validator: (value: T) => boolean | Promise<boolean>; message: string };
  email?: boolean | string;
  url?: boolean | string;
  phone?: boolean | string;
};

export type ValidationSchema<T> = {
  [K in keyof T]?: ValidationRule<T[K]>;
};

export type ValidationErrors<T> = {
  [K in keyof T]?: string;
};

export interface FormFieldState<T> {
  value: T;
  error: string | null;
  touched: boolean;
  dirty: boolean;
}

export interface UseFormValidationReturn<T> {
  values: { [K in keyof T]: T[K] };
  errors: ValidationErrors<T>;
  touched: { [K in keyof T]: boolean };
  dirty: { [K in keyof T]: boolean };
  isValid: boolean;
  isSubmitting: boolean;
  submitCount: number;
  setFieldValue: (name: keyof T, value: T[keyof T]) => void;
  setFieldError: (name: keyof T, error: string | null) => void;
  setFieldTouched: (name: keyof T, touched: boolean) => void;
  handleChange: (name: keyof T) => (value: T[keyof T]) => void;
  handleBlur: (name: keyof T) => () => void;
  handleSubmit: (onSubmit: (values: T) => void | Promise<void>) => (e?: React.FormEvent) => Promise<void>;
  validateField: (name: keyof T) => Promise<string | null>;
  validateAll: () => Promise<{ isValid: boolean; errors: ValidationErrors<T> }>;
  reset: () => void;
  resetField: (name: keyof T) => void;
}

export function useFormValidation<T extends Record<string, any>>(
  initialValues: T,
  schema: ValidationSchema<T>
): UseFormValidationReturn<T> {
  const [values, setValues] = useState<T>(initialValues);
  const [errors, setErrors] = useState<ValidationErrors<T>>({});
  const [touched, setTouched] = useState<{ [K in keyof T]: boolean }>(
    () => Object.keys(initialValues).reduce((acc, key) => {
      (acc as any)[key] = false;
      return acc;
    }, {} as { [K in keyof T]: boolean })
  );
  const [dirty, setDirty] = useState<{ [K in keyof T]: boolean }>(
    () => Object.keys(initialValues).reduce((acc, key) => {
      (acc as any)[key] = false;
      return acc;
    }, {} as { [K in keyof T]: boolean })
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitCount, setSubmitCount] = useState(0);
  const initialValuesRef = useRef(initialValues);
  const errorsRef = useRef(errors);

  errorsRef.current = errors;

  const isValid = useMemo(() => {
    return Object.keys(errors).length === 0;
  }, [errors]);

  const validateSingleField = async (
    name: keyof T,
    value: any
  ): Promise<string | null> => {
    const rules = schema[name];
    if (!rules) return null;

    if (rules.required && (value === undefined || value === null || value === '')) {
      return typeof rules.required === 'string' ? rules.required : '此字段为必填项';
    }

    if (value === undefined || value === null || value === '') {
      return null;
    }

    if (rules.minLength && String(value).length < rules.minLength.value) {
      return rules.minLength.message;
    }

    if (rules.maxLength && String(value).length > rules.maxLength.value) {
      return rules.maxLength.message;
    }

    if (rules.min && (typeof value === 'number' ? value : value.getTime()) < rules.min.value) {
      return rules.min.message;
    }

    if (rules.max && (typeof value === 'number' ? value : value.getTime()) > rules.max.value) {
      return rules.max.message;
    }

    if (rules.pattern && !rules.pattern.value.test(value)) {
      return rules.pattern.message;
    }

    if (rules.email) {
      const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailPattern.test(value)) {
        return typeof rules.email === 'string' ? rules.email : '请输入有效的邮箱地址';
      }
    }

    if (rules.url) {
      try {
        new URL(value);
      } catch {
        return typeof rules.url === 'string' ? rules.url : '请输入有效的URL';
      }
    }

    if (rules.custom) {
      const result = await rules.custom.validator(value);
      if (!result) {
        return rules.custom.message;
      }
    }

    return null;
  };

  const validateAllFields = async (): Promise<{
    isValid: boolean;
    errors: ValidationErrors<T>;
  }> => {
    const newErrors: ValidationErrors<T> = {};

    for (const key of Object.keys(schema) as (keyof T)[]) {
      const error = await validateSingleField(key, values[key]);
      if (error) {
        newErrors[key] = error;
      }
    }

    setErrors(newErrors);

    return {
      isValid: Object.keys(newErrors).length === 0,
      errors: newErrors,
    };
  };

  const setFieldValue = useCallback((name: keyof T, value: T[keyof T]) => {
    setValues((prev) => ({ ...prev, [name]: value }));
    setDirty((prev) => ({ ...prev, [name]: value !== initialValuesRef.current[name] }));

    validateSingleField(name, value).then((error) => {
      setErrors((prev) => ({ ...prev, [name]: error }));
    });
  }, []);

  const setFieldError = useCallback((name: keyof T, error: string | null) => {
    setErrors((prev) => ({ ...prev, [name]: error }));
  }, []);

  const setFieldTouched = useCallback((name: keyof T, isTouched: boolean) => {
    setTouched((prev) => ({ ...prev, [name]: isTouched }));
  }, []);

  const handleChange = useCallback(
    (name: keyof T) => (value: T[keyof T]) => {
      setFieldValue(name, value);
    },
    [setFieldValue]
  );

  const handleBlur = useCallback(
    (name: keyof T) => () => {
      setTouched((prev) => ({ ...prev, [name]: true }));
      validateSingleField(name, values[name]).then((error) => {
        setErrors((prev) => ({ ...prev, [name]: error }));
      });
    },
    [values]
  );

  const handleSubmit = useCallback(
    (onSubmit: (values: T) => void | Promise<void>) =>
      async (e?: React.FormEvent) => {
        e?.preventDefault();

        setSubmitCount((prev) => prev + 1);
        setTouched(
          Object.keys(schema).reduce((acc, key) => {
            (acc as any)[key] = true;
            return acc;
          }, {} as { [K in keyof T]: boolean })
        );

        const { isValid: allValid, errors: validationErrors } = await validateAllFields();

        if (!allValid) {
          logger.debug('[useFormValidation] Validation failed:', validationErrors);
          return;
        }

        setIsSubmitting(true);

        try {
          await onSubmit(values);
          logger.debug('[useFormValidation] Form submitted successfully');
        } catch (error) {
          logger.error('[useFormValidation] Submit error:', error);
          throw error;
        } finally {
          setIsSubmitting(false);
        }
      },
    [values, validateAllFields]
  );

  const validateField = useCallback(
    async (name: keyof T): Promise<string | null> => {
      const error = await validateSingleField(name, values[name]);
      setErrors((prev) => ({ ...prev, [name]: error }));
      return error;
    },
    [values]
  );

  const validateAll = useCallback(() => {
    return validateAllFields();
  }, [validateAllFields]);

  const reset = useCallback(() => {
    setValues(initialValues);
    setErrors({});
    setTouched(
      Object.keys(initialValues).reduce((acc, key) => {
        (acc as any)[key] = false;
        return acc;
      }, {} as { [K in keyof T]: boolean })
    );
    setDirty(
      Object.keys(initialValues).reduce((acc, key) => {
        (acc as any)[key] = false;
        return acc;
      }, {} as { [K in keyof T]: boolean })
    );
    setSubmitCount(0);
    setIsSubmitting(false);
    logger.debug('[useFormValidation] Form reset');
  }, [initialValues]);

  const resetField = useCallback((name: keyof T) => {
    setValues((prev) => ({ ...prev, [name]: initialValuesRef.current[name] }));
    setErrors((prev) => ({ ...prev, [name]: null }));
    setTouched((prev) => ({ ...prev, [name]: false }));
    setDirty((prev) => ({ ...prev, [name]: false }));
  }, []);

  return {
    values,
    errors,
    touched,
    dirty,
    isValid,
    isSubmitting,
    submitCount,
    setFieldValue,
    setFieldError,
    setFieldTouched,
    handleChange,
    handleBlur,
    handleSubmit,
    validateField,
    validateAll,
    reset,
    resetField,
  };
}

export function useFieldValidation<T>(
  value: T,
  rules: ValidationRule<T>
): {
  error: string | null;
  validate: () => Promise<string | null>;
} {
  const [error, setError] = useState<string | null>(null);

  const validate = async (): Promise<string | null> => {
    setError(null);

    if (rules.required && (value === undefined || value === null || value === '')) {
      const err = typeof rules.required === 'string' ? rules.required : '此字段为必填项';
      setError(err);
      return err;
    }

    if (value === undefined || value === null || value === '') {
      setError(null);
      return null;
    }

    if (rules.minLength && String(value).length < rules.minLength.value) {
      const err = rules.minLength.message;
      setError(err);
      return err;
    }

    if (rules.maxLength && String(value).length > rules.maxLength.value) {
      const err = rules.maxLength.message;
      setError(err);
      return err;
    }

    if (rules.pattern && !rules.pattern.value.test(value as string)) {
      const err = rules.pattern.message;
      setError(err);
      return err;
    }

    if (rules.email) {
      const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailPattern.test(value as string)) {
        const err = typeof rules.email === 'string' ? rules.email : '请输入有效的邮箱地址';
        setError(err);
        return err;
      }
    }

    if (rules.custom) {
      const result = await rules.custom.validator(value);
      if (!result) {
        const err = rules.custom.message;
        setError(err);
        return err;
      }
    }

    setError(null);
    return null;
  };

  return { error, validate };
}

export default useFormValidation;
