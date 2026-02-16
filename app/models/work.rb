class Work < ApplicationRecord
  scope :excluding_slugs, ->(slugs) { where.not(slug: slugs) }

  serialize :medium, coder: JSON
  serialize :dimensions, coder: JSON
  serialize :meta, coder: JSON

  validates :title, presence: true
  validates :location, presence: true

  def self.first_random
    order(Arel.sql("RANDOM()")).first
  end

  def height
    dimensions&.dig(0)
  end

  def width
    dimensions&.dig(1)
  end

  def depth
    dimensions&.dig(2)
  end
end
