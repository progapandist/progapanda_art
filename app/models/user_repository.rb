class UserRepository
  include Singleton

  def initialize
    @users = []
  end

  def create(id)
    user = User.new(id, [])
    @users << user
    user
  end

  def find(id)
    @users.find { |user| user.id == id }
  end
end
