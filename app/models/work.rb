class Work < ApplicationRecord
  scope :without_slug, ->(slug) { where.not(slug: slug) }
end
