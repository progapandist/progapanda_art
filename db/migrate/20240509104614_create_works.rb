class CreateWorks < ActiveRecord::Migration[7.1]
  def change
    create_table :works do |t|
      t.string :slug
      t.date :year
      t.integer :listing_price
      t.string :title, default: "", null: false
      t.string :location, default: "", null: false
      t.text :description
      t.text :medium, default: "{}", null: false
      t.text :dimensions, default: "{}", null: false
      t.text :meta, default: "{}", null: false

      t.timestamps
    end
  end
end
