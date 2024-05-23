class Work < ApplicationRecord
  scope :excluding_slugs, ->(slugs) { where.not(slug: slugs) }
  scope :random, -> { order(Arel.sql("RANDOM()")) }

  serialize :medium, JSON
  serialize :dimensions, JSON
  serialize :meta, JSON

  validates :title, presence: true
  validates :location, presence: true

  def self.first_random
    random.first
  end

  def height
    dimensions[0]
  end

  def width
    dimensions[1]
  end

  def depth
    dimensions[2]
  end
end
