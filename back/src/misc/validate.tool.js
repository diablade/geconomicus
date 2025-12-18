import mongoose from 'mongoose';

export const isValidObjectId = (value, helpers) => {
    if (!mongoose.Types.ObjectId.isValid(value)) {
        return helpers.error('any.invalid');
    }
    return value;
};

export const validate = (schema, params = false) => {
    return (req, res, next) => {
        const { error } = schema.validate(params ? req.params : req.body, { abortEarly: false });

        if (error) {
            const errors = error.details.map(detail => ({
                field: detail.path.join('.'),
                message: detail.message
            }));

            return res.status(400).json({
                status: 'validation_error',
                errors
            });
        }
        next();
    };
};
