class Work < ApplicationRecord
  scope :without_slugs, ->(slugs) { where.not(slug: slugs) }
  scope :random, -> { order(Arel.sql("RANDOM()")) }

  def self.first_random
    random.first
  end
end
