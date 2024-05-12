class Work < ApplicationRecord
  scope :without_slugs, ->(slugs) { where.not(slug: slugs) }
end
