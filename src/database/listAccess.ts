export const listVisibilityClause = (userIdParam: number): string =>
	`(is_private = false or owner_user_id = $${userIdParam})`;
