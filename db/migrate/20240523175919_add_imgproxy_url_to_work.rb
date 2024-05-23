class AddImgproxyUrlToWork < ActiveRecord::Migration[7.1]
  def change
    add_column :works, :imgproxy_url, :string
  end
end
